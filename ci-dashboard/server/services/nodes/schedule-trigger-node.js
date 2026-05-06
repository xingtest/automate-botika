const BaseNode = require('./base-node');

class ScheduleTriggerNode extends BaseNode {
  constructor() {
    super({
      type: 'schedule-trigger',
      category: 'trigger',
      label: 'Schedule Trigger',
      description: 'Trigger workflow on schedule',
      icon: 'fa-clock',
      color: '#6366f1',
      inputs: [],
      outputs: [
        { id: 'trigger', name: 'Trigger', dataType: 'object', required: true }
      ],
      config_schema: [
        { key: 'cron_expression', label: 'Cron Expression', type: 'text', required: true, default: '0 9 * * *' },
        { key: 'timezone', label: 'Timezone', type: 'text', required: false, default: 'UTC' }
      ]
    });
  }
  
  async execute(context, config, node) {
    return {
      timestamp: new Date().toISOString(),
      scheduled_time: context.trigger_data.scheduled_time || new Date().toISOString(),
      trigger_type: 'schedule',
      cron_expression: config.cron_expression,
      timezone: config.timezone || 'UTC'
    };
  }
}

module.exports = ScheduleTriggerNode;
