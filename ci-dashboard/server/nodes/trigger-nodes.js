/**
 * Trigger Node Executors
 */

const BaseNode = require('./base-node');

class ManualTriggerNode extends BaseNode {
    constructor() {
        super();
        this.type = 'manual-trigger';
        this.config_schema = {
            fields: [
                {
                    name: 'initialData',
                    type: 'json',
                    placeholder: '{}',
                    description: 'Data JSON yang akan diteruskan ke node berikutnya sebagai input awal'
                }
            ]
        };
    }

    async execute(context, node) {
        const config = node.config || {};
        let triggerData = config.initialData || {};

        // Parse initialData if it's a string
        if (typeof triggerData === 'string') {
            try {
                triggerData = JSON.parse(triggerData);
            } catch (e) {
                console.warn(`[ManualTriggerNode] Failed to parse initialData as JSON: ${e.message}`);
                triggerData = {};
            }
        }

        return {
            timestamp: new Date().toISOString(),
            triggered_by: context.user_id,
            trigger_type: 'manual',
            trigger_data: triggerData
        };
    }
}

class ScheduleTriggerNode extends BaseNode {
    constructor() {
        super();
        this.type = 'schedule-trigger';
    }

    async execute(context, node) {
        const config = node.config || {};
        
        return {
            timestamp: new Date().toISOString(),
            trigger_type: 'schedule',
            cron_expression: config.cron_expression,
            timezone: config.timezone || 'UTC',
            trigger_data: context.trigger_data
        };
    }
}

module.exports = {
    ManualTriggerNode: new ManualTriggerNode(),
    ScheduleTriggerNode: new ScheduleTriggerNode()
};
