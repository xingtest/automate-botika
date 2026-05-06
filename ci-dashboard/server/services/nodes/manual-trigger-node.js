const BaseNode = require('./base-node');

class ManualTriggerNode extends BaseNode {
  constructor() {
    super({
      type: 'manual-trigger',
      category: 'trigger',
      label: 'Manual Trigger',
      description: 'Manually trigger workflow execution',
      icon: 'fa-hand-pointer',
      color: '#6366f1',
      inputs: [],
      outputs: [
        { id: 'trigger', name: 'Trigger', dataType: 'object', required: true }
      ],
      config_schema: []
    });
  }
  
  async execute(context, config, node) {
    return {
      timestamp: new Date().toISOString(),
      triggered_by: context.user_id,
      trigger_type: 'manual',
      trigger_data: context.trigger_data
    };
  }
}

module.exports = ManualTriggerNode;
