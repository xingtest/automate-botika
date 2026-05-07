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
        {
          key: 'duration_seconds',
          label: 'Duration (seconds)',
          type: 'number',
          required: true,
          default: 5,
          description: 'Durasi penundaan dalam detik (0–3600)'
        }
      ]
    });
  }

  async execute(context, config, node) {
    const input = this.getInput(context, 'input');
    let duration = config.duration_seconds ?? 5;

    if (duration > 3600) {
      throw new Error('Wait duration cannot exceed 3600 seconds');
    }

    if (duration < 0) {
      this.log('warn', 'duration_seconds < 0, using 0');
      duration = 0;
    }

    const startTime = Date.now();
    this.log('info', `Waiting for ${duration} seconds`);
    await new Promise(resolve => setTimeout(resolve, duration * 1000));

    return {
      waited_seconds: duration,
      actual_duration_ms: Date.now() - startTime,
      input_passthrough: input
    };
  }
}

module.exports = WaitNode;
