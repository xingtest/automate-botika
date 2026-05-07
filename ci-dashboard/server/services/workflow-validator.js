/**
 * Workflow Validator
 * Validates workflow definitions for correctness and completeness
 */

class WorkflowValidator {
  /**
   * Validate a workflow definition
   * @param {Object} definition - Workflow definition with nodes and connections
   * @returns {Object} - { valid: boolean, errors: Array }
   */
  validate(definition) {
    const errors = [];
    
    if (!definition || typeof definition !== 'object') {
      return { valid: false, errors: [{ code: 'INVALID_DEFINITION', message: 'Definition must be an object' }] };
    }
    
    const { nodes = [], connections = [] } = definition;
    
    if (!Array.isArray(nodes)) {
      return { valid: false, errors: [{ code: 'INVALID_NODES', message: 'Nodes must be an array' }] };
    }
    
    if (!Array.isArray(connections)) {
      return { valid: false, errors: [{ code: 'INVALID_CONNECTIONS', message: 'Connections must be an array' }] };
    }
    
    // Validate exactly one trigger node
    const triggerNodes = nodes.filter(n => n.type && n.type.includes('trigger'));
    if (triggerNodes.length === 0) {
      errors.push({
        code: 'MISSING_TRIGGER',
        message: 'Workflow must have exactly one trigger node',
        severity: 'error'
      });
    } else if (triggerNodes.length > 1) {
      errors.push({
        code: 'MULTIPLE_TRIGGERS',
        message: 'Workflow can only have one trigger node',
        severity: 'error',
        nodes: triggerNodes.map(n => n.id)
      });
    }
    
    // Validate all non-trigger nodes have incoming connections
    const nodeIds = new Set(nodes.map(n => n.id));
    const nodesWithIncoming = new Set(connections.map(c => c.target_node_id));
    
    const orphanedNodes = nodes.filter(n => {
      const isTrigger = n.type && n.type.includes('trigger');
      return !isTrigger && !nodesWithIncoming.has(n.id);
    });
    
    if (orphanedNodes.length > 0) {
      errors.push({
        code: 'ORPHANED_NODES',
        message: 'All non-trigger nodes must have at least one incoming connection',
        severity: 'error',
        nodes: orphanedNodes.map(n => ({ id: n.id, label: n.label }))
      });
    }
    
    // Validate no circular dependencies
    const cycleCheck = this.detectCycles(nodes, connections);
    if (cycleCheck.hasCycle) {
      errors.push({
        code: 'CIRCULAR_DEPENDENCY',
        message: 'Workflow contains circular dependencies',
        severity: 'error',
        cycle: cycleCheck.cycle
      });
    }
    
    // Validate all connections reference valid nodes
    for (const conn of connections) {
      if (!nodeIds.has(conn.source_node_id)) {
        errors.push({
          code: 'INVALID_CONNECTION',
          message: `Connection references non-existent source node: ${conn.source_node_id}`,
          severity: 'error',
          connection: conn.id
        });
      }
      if (!nodeIds.has(conn.target_node_id)) {
        errors.push({
          code: 'INVALID_CONNECTION',
          message: `Connection references non-existent target node: ${conn.target_node_id}`,
          severity: 'error',
          connection: conn.id
        });
      }
    }
    
    // Validate required node parameters
    for (const node of nodes) {
      const configErrors = this.validateNodeConfig(node);
      errors.push(...configErrors);
    }
    
    // Validate expression syntax in condition nodes
    for (const node of nodes) {
      if (node.type === 'condition') {
        const exprErrors = this.validateExpression(node);
        errors.push(...exprErrors);
      }
    }
    
    // Validate connection data type compatibility (warnings only)
    for (const conn of connections) {
      const typeWarnings = this.validateConnectionTypes(conn, nodes);
      errors.push(...typeWarnings);
    }
    
    return {
      valid: errors.filter(e => e.severity === 'error').length === 0,
      errors: errors,
      warnings: errors.filter(e => e.severity === 'warning')
    };
  }
  
  /**
   * Detect cycles in the workflow graph using DFS
   * @param {Array} nodes - Array of nodes
   * @param {Array} connections - Array of connections
   * @returns {Object} - { hasCycle: boolean, cycle: Array }
   */
  detectCycles(nodes, connections) {
    const graph = this.buildAdjacencyList(nodes, connections);
    const visited = new Set();
    const recursionStack = new Set();
    const path = [];
    
    const dfs = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);
      
      const neighbors = graph[nodeId] || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          const result = dfs(neighbor);
          if (result.hasCycle) return result;
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          return {
            hasCycle: true,
            cycle: path.slice(cycleStart).concat(neighbor)
          };
        }
      }
      
      recursionStack.delete(nodeId);
      path.pop();
      return { hasCycle: false };
    };
    
    for (const node of nodes) {
      if (!visited.has(node.id)) {
        const result = dfs(node.id);
        if (result.hasCycle) return result;
      }
    }
    
    return { hasCycle: false };
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
   * Validate node configuration
   * @param {Object} node - Node object
   * @returns {Array} - Array of errors
   */
  validateNodeConfig(node) {
    const errors = [];
    
    if (!node.id) {
      errors.push({
        code: 'MISSING_NODE_ID',
        message: 'Node is missing ID',
        severity: 'error',
        node: node
      });
    }
    
    if (!node.type) {
      errors.push({
        code: 'MISSING_NODE_TYPE',
        message: `Node ${node.id} is missing type`,
        severity: 'error',
        node: node.id
      });
    }
    
    // Validate required config fields based on node type
    const config = node.config || {};
    
    switch (node.type) {
      case 'run-test':
        if (!config.platform) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: platform is required`,
            severity: 'error',
            node: node.id,
            field: 'platform'
          });
        }
        // test_data_file is optional if it's a manual run or platform handles it
        break;
        
      case 'ai-evaluate':
        if (!config.ai_provider) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: ai_provider is required`,
            severity: 'error',
            node: node.id,
            field: 'ai_provider'
          });
        }
        break;
        
      case 'condition':
        if (!config.expression && (!config.value1 || !config.comparison || !config.value2)) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: expression or comparison fields are required`,
            severity: 'error',
            node: node.id
          });
        }
        break;
        
      case 'generate-report':
        if (!config.report_format) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: report_format is required`,
            severity: 'error',
            node: node.id,
            field: 'report_format'
          });
        }
        break;
        
      case 'send-notification':
        if (!config.title && !config.message) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: title and message are required`,
            severity: 'error',
            node: node.id
          });
        }
        break;
      
      case 'telegram':
        if (!config.chatId || !config.text) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: chatId and text are required`,
            severity: 'error',
            node: node.id
          });
        }
        break;
        
      case 'wait':
        if (!config.duration_seconds || config.duration_seconds <= 0) {
          errors.push({
            code: 'INVALID_PARAM',
            message: `Node ${node.id}: duration_seconds must be positive`,
            severity: 'error',
            node: node.id,
            field: 'duration_seconds'
          });
        }
        break;
        
      case 'read-excel':
        if (!config.filePath) {
          errors.push({
            code: 'MISSING_REQUIRED_PARAM',
            message: `Node ${node.id}: filePath is required`,
            severity: 'error',
            node: node.id,
            field: 'filePath'
          });
        }
        break;
    }
    
    return errors;
  }
  
  /**
   * Validate expression syntax in condition nodes
   * @param {Object} node - Condition node
   * @returns {Array} - Array of errors
   */
  validateExpression(node) {
    const errors = [];
    const expression = node.config?.expression;
    
    // Skip if using declarative comparison (value1, comparison, value2)
    if (!expression && node.config?.comparison) {
      return errors;
    }
    
    if (!expression) {
      return errors; // Already caught by validateNodeConfig
    }
    
    try {
      // Basic syntax check - try to create a function
      new Function('context', `return (${expression});`);
    } catch (error) {
      errors.push({
        code: 'INVALID_EXPRESSION',
        message: `Node ${node.id}: Invalid expression syntax - ${error.message}`,
        severity: 'error',
        node: node.id,
        expression: expression
      });
    }
    
    return errors;
  }
  
  /**
   * Validate connection data type compatibility
   * @param {Object} connection - Connection object
   * @param {Array} nodes - Array of nodes
   * @returns {Array} - Array of warnings
   */
  validateConnectionTypes(connection, nodes) {
    const warnings = [];
    
    const sourceNode = nodes.find(n => n.id === connection.source_node_id);
    const targetNode = nodes.find(n => n.id === connection.target_node_id);
    
    if (!sourceNode || !targetNode) {
      return warnings; // Already caught by other validation
    }
    
    // Get port data types
    const sourcePort = sourceNode.outputs?.find(p => p.id === connection.source_port_id);
    const targetPort = targetNode.inputs?.find(p => p.id === connection.target_port_id);
    
    if (!sourcePort || !targetPort) {
      return warnings;
    }
    
    // Check type compatibility
    if (sourcePort.dataType !== 'any' && targetPort.dataType !== 'any') {
      if (sourcePort.dataType !== targetPort.dataType) {
        warnings.push({
          code: 'TYPE_MISMATCH',
          message: `Connection ${connection.id}: Type mismatch - ${sourcePort.dataType} to ${targetPort.dataType}`,
          severity: 'warning',
          connection: connection.id,
          sourceType: sourcePort.dataType,
          targetType: targetPort.dataType
        });
      }
    }
    
    return warnings;
  }
}

module.exports = new WorkflowValidator();
