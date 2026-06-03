/**
 * Execution Context
 * Manages runtime data and state for workflow execution
 */

class ExecutionContext {
  constructor(config) {
    this.workflow_id = config.workflow_id;
    this.execution_id = config.execution_id;
    this.user_id = config.user_id;
    this.trigger_data = config.trigger_data || {};
    this.node_outputs = new Map(); // node_id -> output data
    this.node_status = new Map(); // node_id -> status
    this.node_durations = new Map(); // node_id -> duration_ms
    this.variables = new Map(); // global variables
    this.start_time = new Date();
    this.current_node_id = null;
    this.connections = config.connections || [];
  }
  
  /**
   * Get input data for a specific node from connected upstream node
   * @param {string} portName - Input port name
   * @param {string} nodeId - Optional node ID (defaults to current_node_id)
   * @returns {any} - Input data
   */
  getInput(portName, nodeId = null) {
    const targetNodeId = nodeId || this.current_node_id;
    if (!targetNodeId) {
      return null;
    }
    
    // Find all connections to this node's input port
    const targetConnections = this.connections.filter(c => 
      c.target_node_id === targetNodeId && 
      c.target_port_id === portName
    );
    
    if (targetConnections.length === 0) {
      return null;
    }
    
    if (targetConnections.length === 1) {
      // Get output from source node
      return this.node_outputs.get(targetConnections[0].source_node_id);
    }
    
    // If multiple connections are found, merge their results
    let mergedData = { results: [] };
    let hasData = false;
    
    for (const conn of targetConnections) {
      const output = this.node_outputs.get(conn.source_node_id);
      if (output) {
        hasData = true;
        // Merge results array if exists, and inject platform origin into each item
        if (Array.isArray(output.results)) {
          const platformName = output.platform || 'unknown';
          const taggedResults = output.results.map(item => ({
            ...item,
            platform: platformName
          }));
          mergedData.results = mergedData.results.concat(taggedResults);
        }
        // Merge other properties
        Object.keys(output).forEach(key => {
          if (key !== 'results' && key !== 'success' && key !== 'platform' && key !== 'total_tested') {
            mergedData[key] = output[key];
          }
        });
      }
    }
    
    // Recalculate totals
    mergedData.total_tested = mergedData.results.length;
    mergedData.success = mergedData.results.length > 0;
    
    return hasData ? mergedData : null;
  }
  
  /**
   * Set output data for a node
   * @param {string} portName - Output port name
   * @param {any} data - Output data
   * @param {string} nodeId - Optional node ID (defaults to current_node_id)
   */
  setOutput(portName, data, nodeId = null) {
    const targetNodeId = nodeId || this.current_node_id;
    if (!targetNodeId) {
      throw new Error('No node ID provided for setOutput');
    }
    
    // Store output (make immutable by deep cloning)
    const immutableData = data !== undefined ? JSON.parse(JSON.stringify(data)) : null;
    this.node_outputs.set(targetNodeId, immutableData);
  }
  
  /**
   * Set node status
   * @param {string} nodeId - Node ID
   * @param {string} status - Status (pending, running, success, failed, skipped)
   */
  setNodeStatus(nodeId, status) {
    this.node_status.set(nodeId, status);
  }
  
  /**
   * Get node status
   * @param {string} nodeId - Node ID
   * @returns {string} - Status
   */
  getNodeStatus(nodeId) {
    return this.node_status.get(nodeId) || 'pending';
  }
  
  /**
   * Set node output
   * @param {string} nodeId - Node ID
   * @param {any} output - Output data
   */
  setNodeOutput(nodeId, output) {
    const immutableData = JSON.parse(JSON.stringify(output));
    this.node_outputs.set(nodeId, immutableData);
  }
  
  /**
   * Get node output
   * @param {string} nodeId - Node ID
   * @returns {any} - Output data
   */
  getNodeOutput(nodeId) {
    return this.node_outputs.get(nodeId);
  }
  
  /**
   * Get all node outputs
   * @returns {Object} - Map of node_id -> output
   */
  getAllNodeOutputs() {
    const outputs = {};
    for (const [nodeId, output] of this.node_outputs.entries()) {
      outputs[nodeId] = output;
    }
    return outputs;
  }
  
  /**
   * Set global variable
   * @param {string} key - Variable key
   * @param {any} value - Variable value
   */
  setVariable(key, value) {
    this.variables.set(key, value);
  }
  
  /**
   * Get global variable
   * @param {string} key - Variable key
   * @returns {any} - Variable value
   */
  getVariable(key) {
    return this.variables.get(key);
  }
  
  /**
   * Set node execution duration
   * @param {string} nodeId - Node ID
   * @param {number} duration - Duration in milliseconds
   */
  setNodeDuration(nodeId, duration) {
    this.node_durations.set(nodeId, duration);
  }

  /**
   * Get node execution duration
   * @param {string} nodeId - Node ID
   * @returns {number|undefined} - Duration in ms
   */
  getNodeDuration(nodeId) {
    return this.node_durations.get(nodeId);
  }

  /**
   * Get all node durations as a plain object
   * @returns {Object} - Map of node_id -> duration_ms
   */
  getAllNodeDurations() {
    const durations = {};
    for (const [nodeId, duration] of this.node_durations.entries()) {
      durations[nodeId] = duration;
    }
    return durations;
  }

  /**
   * Get execution duration in milliseconds
   * @returns {number} - Duration in ms
   */
  getDuration() {
    return Date.now() - this.start_time.getTime();
  }
}

module.exports = ExecutionContext;
