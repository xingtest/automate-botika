const BaseNode = require('./base-node');

class TransformDataNode extends BaseNode {
  constructor() {
    super({
      type: 'transform-data',
      category: 'transform',
      label: 'Transform Data',
      description: 'Map and transform data between nodes',
      icon: 'fa-exchange-alt',
      color: '#06b6d4',
      inputs: [
        { id: 'input', name: 'Input', dataType: 'any', required: true }
      ],
      outputs: [
        { id: 'output', name: 'Output', dataType: 'any', required: true }
      ],
      config_schema: [
        { key: 'operation', label: 'Operation', type: 'select', required: true, 
          options: [
            { label: 'Map', value: 'map' },
            { label: 'Filter', value: 'filter' },
            { label: 'Reduce', value: 'reduce' },
            { label: 'Custom', value: 'custom' }
          ]
        },
        { key: 'expression', label: 'Expression', type: 'text', required: false }
      ]
    });
  }
  
  async execute(context, config, node) {
    let input = this.getInput(context, 'input');
    
    if (!input) {
      throw new Error('No input data provided');
    }
    
    let output = input;
    
    switch (config.operation) {
      case 'map':
        if (Array.isArray(input) && config.expression) {
          output = input.map(item => this.evaluateExpression(config.expression, { item }));
        }
        break;
        
      case 'filter':
        if (Array.isArray(input) && config.expression) {
          output = input.filter(item => this.evaluateExpression(config.expression, { item }));
        }
        break;
        
      case 'reduce':
        if (Array.isArray(input) && config.expression) {
          output = input.reduce((acc, item) => this.evaluateExpression(config.expression, { acc, item }), {});
        }
        break;
        
      case 'custom':
        if (config.expression) {
          output = this.evaluateExpression(config.expression, { input });
        }
        break;
    }
    
    return output;
  }
  
  evaluateExpression(expression, context) {
    try {
      const func = new Function(...Object.keys(context), `return (${expression});`);
      return func(...Object.values(context));
    } catch (error) {
      this.log('error', 'Expression evaluation failed', { expression, error: error.message });
      return context.input || context.item;
    }
  }
}

module.exports = TransformDataNode;
