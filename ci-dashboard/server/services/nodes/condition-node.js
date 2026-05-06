const BaseNode = require('./base-node');

class ConditionNode extends BaseNode {
  constructor() {
    super({
      type: 'condition',
      category: 'control',
      label: 'Condition',
      description: 'Route execution based on expression',
      icon: 'fa-code-branch',
      color: '#f59e0b',
      inputs: [
        { id: 'input', name: 'Input', dataType: 'any', required: true }
      ],
      outputs: [
        { id: 'true', name: 'True', dataType: 'any', required: true },
        { id: 'false', name: 'False', dataType: 'any', required: true }
      ],
      config_schema: [
        { key: 'expression', label: 'Condition Expression', type: 'expression', required: true }
      ]
    });
  }
  
  async execute(context, config, node) {
    const input = this.getInput(context, 'input');
    
    // Create evaluation context with input and all node outputs
    const evalContext = {
      input: input,
      ...context.getAllNodeOutputs()
    };
    
    // Safely evaluate expression
    const result = this.safeEvaluate(config.expression, evalContext);
    
    // Route to appropriate output
    if (result) {
      context.setOutput('true', input);
    } else {
      context.setOutput('false', input);
    }
    
    return {
      expression: config.expression,
      result: result,
      routed_to: result ? 'true' : 'false'
    };
  }
  
  safeEvaluate(expression, context) {
    try {
      // Create a safe function with limited scope
      const func = new Function('context', `
        with (context) {
          return (${expression});
        }
      `);
      
      return func(context);
    } catch (error) {
      this.log('error', 'Expression evaluation failed', { expression, error: error.message });
      return false;
    }
  }
}

module.exports = ConditionNode;
