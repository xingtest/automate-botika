/**
 * Base Node Executor
 * Base class for all node executors
 */

class BaseNode {
    constructor() {
        this.type = 'base';
    }

    /**
     * Execute the node
     * @param {ExecutionContext} context - Execution context
     * @param {Object} node - Node configuration
     * @returns {Promise<Object>} - Node output
     */
    async execute(context, node) {
        throw new Error('execute() must be implemented by subclass');
    }

    /**
     * Validate node configuration
     */
    validate(config) {
        return { valid: true };
    }

    /**
     * Get input data from context
     */
    getInput(context, nodeId, portName = null) {
        return context.getInput(nodeId, portName);
    }

    /**
     * Replace template variables in string
     */
    replaceVariables(template, data) {
        if (!template || typeof template !== 'string') return template;
        
        return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
            const value = this.getNestedValue(data, path.trim());
            return value !== undefined ? value : match;
        });
    }

    /**
     * Get nested value from object using dot notation
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

module.exports = BaseNode;
