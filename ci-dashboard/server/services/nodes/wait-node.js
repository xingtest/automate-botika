const BaseNode = require('./base-node');

class WaitNode extends BaseNode {
  constructor() {
    super({
      type: 'wait',
      category: 'control',
      label: 'Wait',
      description: 'Pause execution for specified duration',
      icon: 'fa-hourglass-half',
      color: '#f59e0b',
      inputs: [
        { id: 'input', name: 'Input', dataType: 'any', required: false }
      ],
      outputs: [
        { id: 'output', name: 'Output', dataType: 'any', required: true }
      ],
      config_schema: [
        { key: 'duration_seconds', label: 'Duration (seconds)', type: 'number', required: true, default: 5 }
      ]
    });
  }
  
  async execute(context, config, node) {
    const startTime = Date.now();
    const durationMs = (config.duration_seconds || 5) * 1000;
    
    this.log('info', `Waiting for ${config.duration_seconds} seconds`);
    
    await new Promise(resolve => setTimeout(resolve, durationMs));
    
    const actualDuration = Date.now() - startTime;
    
    return {
      waited_seconds: config.duration_seconds,
      actual_duration_ms: actualDuration
    };
  }
}

module.exports = WaitNode;
