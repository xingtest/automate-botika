/**
 * Control Flow Node Executors
 */

const BaseNode = require('./base-node');
const vm = require('vm');

class ConditionNode extends BaseNode {
    constructor() {
        super();
        this.type = 'condition';
        this.config_schema = {
            fields: [
                {
                    name: 'value1',
                    type: 'string',
                    description: 'Nilai atau ekspresi yang akan dibandingkan'
                },
                {
                    name: 'comparison',
                    type: 'options',
                    options: [
                        { name: 'Equal', value: 'equal' },
                        { name: 'Not Equal', value: 'not_equal' },
                        { name: 'Greater Than', value: 'greater_than' },
                        { name: 'Less Than', value: 'less_than' },
                        { name: 'Greater Than or Equal', value: 'greater_than_or_equal' },
                        { name: 'Less Than or Equal', value: 'less_than_or_equal' },
                        { name: 'Contains', value: 'contains' },
                        { name: 'Not Contains', value: 'not_contains' }
                    ],
                    default: 'equal'
                },
                {
                    name: 'value2',
                    type: 'string',
                    description: 'Nilai pembanding'
                }
            ]
        };
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'input');

        try {
            const value1 = this.resolveTemplate(config.value1, input);
            const value2 = this.resolveTemplate(config.value2, input);
            const operator = config.comparison || 'equal';

            console.log(`[ConditionNode] Comparing: "${value1}" ${operator} "${value2}"`);

            const result = this.compare(value1, operator, value2);

            console.log(`[ConditionNode] Comparison result: ${result}`);

            return {
                value1,
                value2,
                operator,
                result: Boolean(result),
                routed_to: result ? 'true' : 'false',
                input_data: input
            };
        } catch (error) {
            console.error('[ConditionNode] Evaluation error:', error);
            // Route to false on error
            return {
                value1: config.value1,
                value2: config.value2,
                operator: config.comparison,
                result: false,
                routed_to: 'false',
                input_data: input,
                error: error.message
            };
        }
    }

    /**
     * Resolve template variables like {{ $json.field }} from input
     */
    resolveTemplate(value, input) {
        if (!value || typeof value !== 'string') {
            return value;
        }

        // Match {{ $json.field.path }} pattern
        return value.replace(/\{\{\s*\$json\.([^}]+)\s*\}\}/g, (match, path) => {
            const resolvedValue = this.getNestedValue(input, path.trim());
            return resolvedValue !== undefined ? resolvedValue : match;
        });
    }

    /**
     * Compare two values with specified operator
     */
    compare(v1, operator, v2) {
        // Try numeric comparison if both are numbers
        const num1 = parseFloat(v1);
        const num2 = parseFloat(v2);
        const isNumeric = !isNaN(num1) && !isNaN(num2) && 
                         v1.toString().trim() !== '' && v2.toString().trim() !== '';

        switch (operator) {
            case 'equal':
                return isNumeric ? num1 === num2 : v1 == v2;
            case 'not_equal':
                return isNumeric ? num1 !== num2 : v1 != v2;
            case 'greater_than':
                return isNumeric ? num1 > num2 : String(v1) > String(v2);
            case 'less_than':
                return isNumeric ? num1 < num2 : String(v1) < String(v2);
            case 'greater_than_or_equal':
                return isNumeric ? num1 >= num2 : String(v1) >= String(v2);
            case 'less_than_or_equal':
                return isNumeric ? num1 <= num2 : String(v1) <= String(v2);
            case 'contains':
                return String(v1).includes(String(v2));
            case 'not_contains':
                return !String(v1).includes(String(v2));
            default:
                console.warn(`[ConditionNode] Unknown operator: ${operator}, defaulting to false`);
                return false;
        }
    }
}

class WaitNode extends BaseNode {
    constructor() {
        super();
        this.type = 'wait';
        this.config_schema = {
            fields: [
                {
                    name: 'duration_seconds',
                    type: 'number',
                    default: 5,
                    description: 'Durasi penundaan dalam detik (0–3600)'
                }
            ]
        };
    }

    async execute(context, node) {
        const config = node.config || {};
        let duration_seconds = config.duration_seconds || 5;

        // Validation
        if (duration_seconds > 3600) {
            throw new Error('Wait duration cannot exceed 3600 seconds');
        }
        if (duration_seconds < 0) {
            console.warn(`[WaitNode] Negative duration (${duration_seconds}s), setting to 0`);
            duration_seconds = 0;
        }

        console.log(`[WaitNode] Waiting for ${duration_seconds} seconds`);

        // Get input for passthrough
        const input = this.getInput(context, node.id, 'input');

        const startTime = Date.now();
        await this.sleep(duration_seconds * 1000);
        const actualDuration = Date.now() - startTime;

        return {
            waited_seconds: duration_seconds,
            actual_duration_ms: actualDuration,
            timestamp: new Date().toISOString(),
            input_passthrough: input
        };
    }
}

module.exports = {
    ConditionNode: new ConditionNode(),
    WaitNode: new WaitNode()
};
