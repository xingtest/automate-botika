/**
 * Trigger Node Executors
 */

const BaseNode = require('./base-node');

class ManualTriggerNode extends BaseNode {
    constructor() {
        super();
        this.type = 'manual-trigger';
    }

    async execute(context, node) {
        return {
            timestamp: new Date().toISOString(),
            triggered_by: context.user_id,
            trigger_type: 'manual',
            trigger_data: context.trigger_data
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
