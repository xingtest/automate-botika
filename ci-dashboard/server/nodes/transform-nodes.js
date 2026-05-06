/**
 * Transform Node Executors
 */

const BaseNode = require('./base-node');

class TransformDataNode extends BaseNode {
    constructor() {
        super();
        this.type = 'transform-data';
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'input');

        if (!input) {
            throw new Error('No input data provided');
        }

        const { operation, mapping } = config;

        console.log(`[TransformDataNode] Applying ${operation} transformation`);

        let output = input;

        switch (operation) {
            case 'map':
                output = this.applyMap(input, mapping);
                break;
            case 'filter':
                output = this.applyFilter(input, mapping);
                break;
            case 'extract':
                output = this.extractFields(input, mapping);
                break;
            default:
                throw new Error(`Unknown transformation operation: ${operation}`);
        }

        return output;
    }

    /**
     * Apply map transformation
     */
    applyMap(input, mapping) {
        if (!Array.isArray(input)) {
            input = [input];
        }

        if (!mapping || typeof mapping !== 'object') {
            return input;
        }

        return input.map(item => {
            const mapped = {};
            for (const [key, path] of Object.entries(mapping)) {
                mapped[key] = this.getNestedValue(item, path);
            }
            return mapped;
        });
    }

    /**
     * Apply filter transformation
     */
    applyFilter(input, mapping) {
        if (!Array.isArray(input)) {
            return input;
        }

        if (!mapping || !mapping.condition) {
            return input;
        }

        // Simple filter based on field value
        const { field, operator = '==', value } = mapping;

        return input.filter(item => {
            const itemValue = this.getNestedValue(item, field);
            
            switch (operator) {
                case '==':
                    return itemValue == value;
                case '!=':
                    return itemValue != value;
                case '>':
                    return itemValue > value;
                case '<':
                    return itemValue < value;
                case '>=':
                    return itemValue >= value;
                case '<=':
                    return itemValue <= value;
                case 'includes':
                    return Array.isArray(itemValue) && itemValue.includes(value);
                default:
                    return true;
            }
        });
    }

    /**
     * Extract specific fields
     */
    extractFields(input, mapping) {
        if (!mapping || !mapping.fields) {
            return input;
        }

        const fields = mapping.fields;

        if (Array.isArray(input)) {
            return input.map(item => {
                const extracted = {};
                fields.forEach(field => {
                    extracted[field] = item[field];
                });
                return extracted;
            });
        } else {
            const extracted = {};
            fields.forEach(field => {
                extracted[field] = input[field];
            });
            return extracted;
        }
    }
}

module.exports = {
    TransformDataNode: new TransformDataNode()
};
