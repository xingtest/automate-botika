/**
 * Workflow Execution Engine
 * Orchestrates workflow execution with topological sorting and parallel execution
 */

const { pool: db } = require('../db');
const ExecutionContext = require('./execution-context');
const nodeRegistry = require('./node-registry');

class ExecutionEngine {
  constructor() {
    this.activeExecutions = new Map(); // execution_id -> context
    this.maxConcurrentNodes = 5;
  }
  
  /**
   * Execute a workflow
   * @param {string} executionId - Execution ID
   * @param {Object} workflow - Workflow object with definition
   * @param {number} userId - User ID
   * @param {Object} triggerData - Trigger data
   */
  async execute(executionId, workflow, userId, triggerData) {
    let context = null;
    
    try {
      console.log(`[ExecutionEngine] Starting execution: ${executionId}`);
      
      // Validate workflow before execution
      const validation = nodeRegistry.validateWorkflow(workflow.definition);
      
      if (!validation.valid) {
        const errorMsg = `Workflow validation failed. Missing nodes: ${validation.missingNodes.join(', ')}`;
        console.error(`[ExecutionEngine] ${errorMsg}`);
        
        // Create context for logging
        context = new ExecutionContext({
          workflow_id: workflow.id,
          execution_id: executionId,
          user_id: userId,
          trigger_data: triggerData,
          connections: workflow.definition.connections || []
        });
        
        // Mark as failed immediately
        await db.queryOriginal(
          `UPDATE workflow_executions 
           SET status = 'failed', error_message = $1, start_time = CURRENT_TIMESTAMP, end_time = CURRENT_TIMESTAMP
           WHERE execution_id = $2`,
          [errorMsg, executionId]
        );
        
        throw new Error(errorMsg);
      }
      
      console.log(`[ExecutionEngine] Workflow validation passed: ${validation.availableNodes.length}/${validation.totalNodes} nodes available`);
      
      // Create execution context
      context = new ExecutionContext({
        workflow_id: workflow.id,
        execution_id: executionId,
        user_id: userId,
        trigger_data: triggerData,
        connections: workflow.definition.connections || []
      });
      
      this.activeExecutions.set(executionId, context);
      
      // Update status to running
      await db.queryOriginal(
        `UPDATE workflow_executions 
         SET status = 'running', start_time = CURRENT_TIMESTAMP 
         WHERE execution_id = $1`,
        [executionId]
      );
      
      // Get nodes and connections
      const nodes = workflow.definition.nodes || [];
      const connections = workflow.definition.connections || [];
      
      // NEW: Only execute nodes reachable from triggers
      const { getActiveNodeIds } = require('./graph-utils');
      const activeNodeIds = getActiveNodeIds(nodes, connections);
      const activeNodes = nodes.filter(n => activeNodeIds.has(n.id));
      const activeConnections = connections.filter(c => 
        activeNodeIds.has(c.source_node_id) && activeNodeIds.has(c.target_node_id)
      );
      
      console.log(`[ExecutionEngine] Active nodes: ${activeNodes.length}/${nodes.length}, active connections: ${activeConnections.length}/${connections.length}`);
      
      // Topological sort to get execution order (using only active nodes and connections)
      const executionOrder = this.topologicalSort(activeNodes, activeConnections);
      
      // NEW: Parallel execution logic
      const nodesToRun = new Set(activeNodeIds);
      const runningNodes = new Map(); // nodeId -> promise
      const completedNodes = new Set();
      const inDegree = this.calculateInDegree(this.buildAdjacencyList(activeNodes, activeConnections), activeNodes);
      
      console.log(`[ExecutionEngine] Starting parallel execution loop for ${activeNodeIds.size} nodes...`);

      while (nodesToRun.size > 0 || runningNodes.size > 0) {
        // Find nodes ready to run (inDegree 0 and not already running/completed)
        const readyToStart = Array.from(nodesToRun).filter(id => 
          inDegree[id] === 0 && !runningNodes.has(id)
        );
        
        // Start as many ready nodes as possible within concurrency limit
        const limit = this.maxConcurrentNodes - runningNodes.size;
        const nodesToStartNow = readyToStart.slice(0, Math.max(0, limit));

        for (const nodeId of nodesToStartNow) {
          const node = nodes.find(n => n.id === nodeId);
          if (!node) continue;

          console.log(`[ExecutionEngine] Starting node in parallel: ${nodeId} (${node.type})`);
          
          // Mark as running in tracking set
          runningNodes.set(nodeId, (async () => {
            try {
              // Check if AT LEAST ONE dependency completed successfully
              // This allows Fan-In (multiple parallel branches merging into one node) to continue even if some branches fail
              const dependencies = this.getUpstreamNodes(nodeId, activeConnections);
              const anySuccess = dependencies.length === 0 || dependencies.some(depId => context.getNodeStatus(depId) === 'success');
              
              if (!anySuccess) {
                context.setNodeStatus(nodeId, 'skipped');
                await this.logNodeExecution(executionId, node, 'skipped', null, null, 'All upstream dependencies failed or skipped');
                return;
              }

              // Create node-scoped context to avoid shared state issues
              const scopedContext = Object.create(context);
              scopedContext.current_node_id = nodeId;

              context.setNodeStatus(nodeId, 'running');
              await this.logNodeExecution(executionId, node, 'running');
              
              const startTime = Date.now();
              const executor = nodeRegistry.getNodeExecutor(node.type);
              
              if (!executor) {
                throw new Error(`No executor found for node type: ${node.type}`);
              }
              
              // Execute node
              const result = await executor.execute(scopedContext, node.config, node);
              const duration = Date.now() - startTime;
              
              context.setNodeOutput(nodeId, result);
              context.setNodeDuration(nodeId, duration);
              context.setNodeStatus(nodeId, 'success');
              await this.logNodeExecution(executionId, node, 'success', result, null, null, duration);
              
            } catch (error) {
              console.error(`[ExecutionEngine] Node ${nodeId} failed:`, error.message);
              context.setNodeStatus(nodeId, 'failed');
              await this.logNodeExecution(executionId, node, 'failed', null, null, error.message);
              
              // We don't throw here anymore so other parallel nodes can continue
              // Only downstream nodes will be affected because their inDegree won't be satisfied
              // or they will be caught by the allSuccess check.
            } finally {
              // Node finished (success/fail/skipped)
              completedNodes.add(nodeId);
              
              // Decrement in-degree for all children
              const children = activeConnections.filter(c => c.source_node_id === nodeId).map(c => c.target_node_id);
              for (const childId of children) {
                inDegree[childId] = Math.max(0, (inDegree[childId] || 0) - 1);
              }
            }
          })());
          
          // Remove from the "to run" pool
          nodesToRun.delete(nodeId);
        }

        if (runningNodes.size === 0 && nodesToRun.size > 0) {
          // Deadlock or cycles (should have been caught by validation)
          throw new Error('Workflow execution stalled - possible circular dependency or validation error');
        }

        // Wait for any of the running nodes to finish
        if (runningNodes.size > 0) {
          const promises = Array.from(runningNodes.entries()).map(([id, p]) => 
            p.then(() => id)
          );
          
          const finishedNodeId = await Promise.race(promises);
          runningNodes.delete(finishedNodeId);
        } else {
          // Small delay if we're waiting for something
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }
      
      // Mark execution as completed
      const totalDuration = context.getDuration();
      await db.queryOriginal(
        `UPDATE workflow_executions 
         SET status = 'completed', end_time = CURRENT_TIMESTAMP, duration_ms = $1 
         WHERE execution_id = $2`,
        [totalDuration, executionId]
      );
      
      // Log activity
      await db.queryOriginal(
        `INSERT INTO activity_logs (user_id, title, description, type)
         VALUES ($1, $2, $3, 'workflow')`,
        [userId, 'Workflow Completed', `Workflow execution ${executionId} completed successfully`]
      );
      
      return {
        execution_id: executionId,
        status: 'completed',
        duration_ms: totalDuration,
        node_results: (() => {
          const allOutputs = context.getAllNodeOutputs();
          const allDurations = context.getAllNodeDurations();
          const allStatuses = {};
          for (const [nodeId, status] of context.node_status.entries()) {
            allStatuses[nodeId] = status;
          }

          const nodeResults = {};
          for (const nodeId of Object.keys(allOutputs)) {
            nodeResults[nodeId] = {
              status: allStatuses[nodeId] || 'success',
              duration_ms: allDurations[nodeId] || null,
              output: allOutputs[nodeId],
              error_message: null
            };
          }
          // Also add failed/skipped nodes that have no output
          for (const [nodeId, status] of context.node_status.entries()) {
            if (!nodeResults[nodeId]) {
              nodeResults[nodeId] = {
                status,
                duration_ms: allDurations[nodeId] || null,
                output: null,
                error_message: null
              };
            }
          }
          return nodeResults;
        })()
      };
      
    } catch (error) {
      console.error('Workflow execution failed:', error);
      
      const duration = context ? context.getDuration() : 0;
      
      // Mark execution as failed
      await db.queryOriginal(
        `UPDATE workflow_executions 
         SET status = 'failed', end_time = CURRENT_TIMESTAMP, duration_ms = $1, error_message = $2 
         WHERE execution_id = $3`,
        [duration, error.message, executionId]
      );
      
      // Log activity
      await db.queryOriginal(
        `INSERT INTO activity_logs (user_id, title, description, type)
         VALUES ($1, $2, $3, 'error')`,
        [userId, 'Workflow Failed', `Workflow execution ${executionId} failed: ${error.message}`]
      );
      
      throw error;
      
    } finally {
      // Clean up
      this.activeExecutions.delete(executionId);
    }
  }
  
  /**
   * Topological sort using Kahn's algorithm
   * @param {Array} nodes - Array of nodes
   * @param {Array} connections - Array of connections
   * @returns {Array} - Sorted array of node IDs
   */
  topologicalSort(nodes, connections) {
    const graph = this.buildAdjacencyList(nodes, connections);
    const inDegree = this.calculateInDegree(graph, nodes);
    const queue = [];
    const result = [];
    
    // Find all nodes with no incoming edges (trigger nodes)
    for (const node of nodes) {
      if (inDegree[node.id] === 0) {
        queue.push(node.id);
      }
    }
    
    while (queue.length > 0) {
      const nodeId = queue.shift();
      result.push(nodeId);
      
      // Reduce in-degree for all neighbors
      const neighbors = graph[nodeId] || [];
      for (const neighbor of neighbors) {
        inDegree[neighbor]--;
        if (inDegree[neighbor] === 0) {
          queue.push(neighbor);
        }
      }
    }
    
    // Check for cycles
    if (result.length !== nodes.length) {
      throw new Error('Circular dependency detected in workflow');
    }
    
    return result;
  }
  
  /**
   * Build adjacency list from nodes and connections
   * @param {Array} nodes - Array of nodes
   * @param {Array} connections - Array of connections
   * @returns {Object} - Adjacency list
   */
  buildAdjacencyList(nodes, connections) {
    const graph = {};
    
    // Initialize graph
    for (const node of nodes) {
      graph[node.id] = [];
    }
    
    // Add edges
    for (const conn of connections) {
      if (graph[conn.source_node_id]) {
        graph[conn.source_node_id].push(conn.target_node_id);
      }
    }
    
    return graph;
  }
  
  /**
   * Calculate in-degree for each node
   * @param {Object} graph - Adjacency list
   * @param {Array} nodes - Array of nodes
   * @returns {Object} - Map of node_id -> in-degree
   */
  calculateInDegree(graph, nodes) {
    const inDegree = {};
    
    // Initialize all nodes with 0
    for (const node of nodes) {
      inDegree[node.id] = 0;
    }
    
    // Count incoming edges
    for (const nodeId in graph) {
      for (const neighbor of graph[nodeId]) {
        inDegree[neighbor]++;
      }
    }
    
    return inDegree;
  }
  
  /**
   * Get upstream nodes (dependencies) for a node
   * @param {string} nodeId - Node ID
   * @param {Array} connections - Array of connections
   * @returns {Array} - Array of upstream node IDs
   */
  getUpstreamNodes(nodeId, connections) {
    return connections
      .filter(c => c.target_node_id === nodeId)
      .map(c => c.source_node_id);
  }
  
  /**
   * Log node execution to database
   * @param {string} executionId - Execution ID
   * @param {Object} node - Node object
   * @param {string} status - Status (success, failed, skipped)
   * @param {any} outputData - Output data
   * @param {any} inputData - Input data
   * @param {string} errorMessage - Error message if failed
   * @param {number} duration - Duration in ms
   */
  async logNodeExecution(executionId, node, status, outputData, inputData, errorMessage, duration = 0) {
    try {
      // Check if this node execution already has a record
      const checkResult = await db.queryOriginal(
        'SELECT id FROM node_executions WHERE execution_id = $1 AND node_id = $2',
        [executionId, node.id]
      );

      if (checkResult.rows.length > 0) {
        // Update existing record
        await db.queryOriginal(
          `UPDATE node_executions 
           SET status = $1, output_data = $2, error_message = $3, duration_ms = $4, end_time = CURRENT_TIMESTAMP
           WHERE execution_id = $5 AND node_id = $6`,
          [
            status,
            outputData ? JSON.stringify(outputData) : null,
            errorMessage,
            duration,
            executionId,
            node.id
          ]
        );
      } else {
        // Insert new record
        await db.queryOriginal(
          `INSERT INTO node_executions 
           (execution_id, node_id, node_type, status, input_data, output_data, error_message, start_time, end_time, duration_ms)
           VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $8)`,
          [
            executionId,
            node.id,
            node.type,
            status,
            inputData ? JSON.stringify(inputData) : null,
            outputData ? JSON.stringify(outputData) : null,
            errorMessage,
            duration
          ]
        );
      }
    } catch (error) {
      console.error('Failed to log node execution:', error);
    }
  }
  
  /**
   * Cancel an active execution
   * @param {string} executionId - Execution ID
   */
  async cancelExecution(executionId) {
    const context = this.activeExecutions.get(executionId);
    if (context) {
      // Mark as cancelled
      await db.queryOriginal(
        `UPDATE workflow_executions 
         SET status = 'cancelled', end_time = CURRENT_TIMESTAMP 
         WHERE execution_id = $1`,
        [executionId]
      );
      
      this.activeExecutions.delete(executionId);
    }
  }
  
  /**
   * Get active execution context
   * @param {string} executionId - Execution ID
   * @returns {ExecutionContext} - Execution context
   */
  getExecutionContext(executionId) {
    return this.activeExecutions.get(executionId);
  }
}

module.exports = new ExecutionEngine();
