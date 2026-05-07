/**
 * Transform Node Executors
 */

const BaseNode = require('./base-node');
const vm = require('vm');

class TransformDataNode extends BaseNode {
    constructor() {
        super();
        this.type = 'transform-data';
        this.config_schema = {
            fields: [
                {
                    name: 'jsCode',
                    type: 'textarea',
                    description: 'Kode JavaScript untuk transformasi data. Gunakan variabel `items` untuk mengakses data input'
                }
            ]
        };
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'input');

        if (!input) {
            throw new Error('No input data provided');
        }

        const jsCode = config.jsCode || config.expression || 'items';

        console.log(`[TransformDataNode] Executing transform code`);

        try {
            // Create sandbox with safe globals
            const items = Array.isArray(input) ? input : [input];
            const sandbox = {
                items,
                context: {
                    execution_id: context.execution_id,
                    workflow_id: context.workflow_id,
                    user_id: context.user_id
                },
                JSON,
                Math,
                Date,
                Array,
                Object,
                String,
                Number,
                console: { log: () => {} } // No-op console
            };

            // Create VM context and script
            const vmContext = vm.createContext(sandbox);
            const script = new vm.Script(`
                (function() {
                    ${jsCode}
                    return items;
                })()
            `);

            // Execute with timeout using Promise.race
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Transform code execution timeout (10s)')), 10000);
            });

            const executionPromise = new Promise((resolve) => {
                const result = script.runInContext(vmContext, { timeout: 10000 });
                resolve(result);
            });

            const output = await Promise.race([executionPromise, timeoutPromise]);

            return output;
        } catch (error) {
            console.error('[TransformDataNode] Transform execution error:', error);
            throw new Error(`Transform code execution failed: ${error.message}`);
        }
    }
}

module.exports = {
    TransformDataNode: new TransformDataNode()
};
