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
      config_schema: [
        {
          key: 'initialData',
          label: 'Initial Data',
          type: 'json',
          required: false,
          default: '{}',
          description: 'Data JSON yang akan diteruskan ke node berikutnya sebagai input awal',
          placeholder: '{}'
        }
      ]
    });
  }

  async execute(context, config, node) {
    let triggerData = {};

    if (config.initialData !== undefined && config.initialData !== null && config.initialData !== '') {
      if (typeof config.initialData === 'object') {
        triggerData = config.initialData;
      } else if (typeof config.initialData === 'string') {
        try {
          triggerData = JSON.parse(config.initialData);
        } catch (e) {
          this.log('warn', 'initialData is not valid JSON, using {}', { value: config.initialData });
          triggerData = {};
        }
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

module.exports = ManualTriggerNode;
