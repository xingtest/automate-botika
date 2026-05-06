/**
 * Base Node Executor
 * Base class for all node executors
 */

class BaseNode {
  constructor(schema) {
    this.schema = schema;
  }
  
  /**
   * Execute the node
   * @param {ExecutionContext} context - Execution context
   * @param {Object} config - Node configuration
   * @param {Object} node - Full node object
   * @returns {Promise<any>} - Node output
   */
  async execute(context, config, node) {
    throw new Error('execute() must be implemented by subclass');
  }
  
  /**
   * Validate node configuration
   * @param {Object} config - Node configuration
   * @returns {Object} - { valid: boolean, errors: Array }
   */
  validate(config) {
    const errors = [];
    
    if (!this.schema || !this.schema.config_schema) {
      return { valid: true, errors: [] };
    }
    
    for (const field of this.schema.config_schema) {
      if (field.required && !config[field.key]) {
        errors.push({
          field: field.key,
          message: `${field.label} is required`
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  /**
   * Get input from context
   * @param {ExecutionContext} context - Execution context
   * @param {string} portName - Input port name
   * @returns {any} - Input data
   */
  getInput(context, portName = 'input') {
    return context.getInput(portName);
  }
  
  /**
   * Set output to context
   * @param {ExecutionContext} context - Execution context
   * @param {any} data - Output data
   * @param {string} portName - Output port name
   */
  setOutput(context, data, portName = 'output') {
    context.setOutput(portName, data);
  }
  
  /**
   * Log message
   * @param {string} level - Log level (info, warn, error)
   * @param {string} message - Log message
   * @param {Object} data - Additional data
   */
  log(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}`, data);
  }
}

module.exports = BaseNode;
