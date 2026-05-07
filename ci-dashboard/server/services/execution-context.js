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
   * Get input data for current node from connected upstream node
   * @param {string} portName - Input port name
   * @returns {any} - Input data
   */
  getInput(portName) {
    if (!this.current_node_id) {
      return null;
    }
    
    // Find connection to this node's input port
    const connection = this.connections.find(c => 
      c.target_node_id === this.current_node_id && 
      c.target_port_id === portName
    );
    
    if (!connection) {
      return null;
    }
    
    // Get output from source node
    return this.node_outputs.get(connection.source_node_id);
  }
  
  /**
   * Set output data for current node
   * @param {string} portName - Output port name
   * @param {any} data - Output data
   */
  setOutput(portName, data) {
    if (!this.current_node_id) {
      throw new Error('No current node set');
    }
    
    // Store output (make immutable by deep cloning)
    const immutableData = JSON.parse(JSON.stringify(data));
    this.node_outputs.set(this.current_node_id, immutableData);
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
