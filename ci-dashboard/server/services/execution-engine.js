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
      
      // Topological sort to get execution order
      const executionOrder = this.topologicalSort(nodes, connections);
      
      // Execute nodes in order
      for (const nodeId of executionOrder) {
        const node = nodes.find(n => n.id === nodeId);
        
        if (!node) {
          console.error(`Node ${nodeId} not found in workflow`);
          continue;
        }
        
        // Check if all dependencies completed successfully
        const dependencies = this.getUpstreamNodes(nodeId, connections);
        const allCompleted = dependencies.every(depId => 
          context.getNodeStatus(depId) === 'success'
        );
        
        if (!allCompleted) {
          context.setNodeStatus(nodeId, 'skipped');
          await this.logNodeExecution(executionId, node, 'skipped', null, null, 'Dependencies not met');
          continue;
        }
        
        // Execute node
        try {
          context.setNodeStatus(nodeId, 'running');
          context.current_node_id = nodeId;
          
          // Log start of execution
          await this.logNodeExecution(executionId, node, 'running');
          
          const startTime = Date.now();
          
          // Get node executor
          console.log(`[ExecutionEngine] Executing node: ${node.id} (type: "${node.type}")`);
          const executor = nodeRegistry.getNodeExecutor(node.type);
          if (!executor) {
            const registeredTypes = Array.from(nodeRegistry.nodeExecutors.keys()).join(', ');
            console.error(`[ExecutionEngine] NO EXECUTOR for type: "${node.type}". Registered types: [${registeredTypes}]`);
            throw new Error(`No executor found for node type: ${node.type}`);
          }
          
          // Execute node
          const result = await executor.execute(context, node.config, node);
          
          const duration = Date.now() - startTime;
          
          // Store result
          context.setNodeOutput(nodeId, result);
          context.setNodeDuration(nodeId, duration);
          context.setNodeStatus(nodeId, 'success');
          
          // Log execution
          await this.logNodeExecution(executionId, node, 'success', result, null, null, duration);
          
        } catch (error) {
          console.error(`Node ${nodeId} execution failed:`, error);
          
          const duration = Date.now() - context.start_time.getTime();
          context.setNodeStatus(nodeId, 'failed');
          
          await this.logNodeExecution(executionId, node, 'failed', null, null, error.message, duration);
          
          // Check if we should continue on error
          if (!node.config?.continueOnError) {
            // Halt execution
            throw error;
          }
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
