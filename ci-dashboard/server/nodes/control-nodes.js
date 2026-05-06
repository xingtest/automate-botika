/**
 * Control Flow Node Executors
 */

const BaseNode = require('./base-node');
const vm = require('vm');

class ConditionNode extends BaseNode {
    constructor() {
        super();
        this.type = 'condition';
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'input');

        if (!config.expression) {
            throw new Error('Condition expression is required');
        }

        console.log(`[ConditionNode] Evaluating expression: ${config.expression}`);

        // Evaluate expression safely
        const result = this.evaluateExpression(config.expression, input, context);

        console.log(`[ConditionNode] Expression result: ${result}`);

        return {
            expression: config.expression,
            result: Boolean(result),
            routed_to: result ? 'true' : 'false',
            input_data: input
        };
    }

    /**
     * Safely evaluate JavaScript expression
     */
    evaluateExpression(expression, input, context) {
        try {
            // Create sandbox context
            const sandbox = {
                input: input,
                Math: Math,
                String: String,
                Number: Number,
                Boolean: Boolean,
                Array: Array,
                Object: Object,
                Date: Date,
                JSON: JSON,
                // Helper functions
                includes: (arr, val) => arr && arr.includes(val),
                startsWith: (str, prefix) => str && str.startsWith(prefix),
                endsWith: (str, suffix) => str && str.endsWith(suffix)
            };

            // Create VM context with timeout
            const vmContext = vm.createContext(sandbox);
            const script = new vm.Script(`(${expression})`);
            
            // Execute with timeout (5 seconds)
            const result = script.runInContext(vmContext, { timeout: 5000 });
            
            return result;
        } catch (error) {
            console.error('[ConditionNode] Expression evaluation error:', error);
            throw new Error(`Expression evaluation failed: ${error.message}`);
        }
    }
}

class WaitNode extends BaseNode {
    constructor() {
        super();
        this.type = 'wait';
    }

    async execute(context, node) {
        const config = node.config || {};
        const duration_seconds = config.duration_seconds || 5;

        console.log(`[WaitNode] Waiting for ${duration_seconds} seconds`);

        const startTime = Date.now();
        await this.sleep(duration_seconds * 1000);
        const actualDuration = Date.now() - startTime;

        return {
            waited_seconds: duration_seconds,
            actual_duration_ms: actualDuration,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    ConditionNode: new ConditionNode(),
    WaitNode: new WaitNode()
};
