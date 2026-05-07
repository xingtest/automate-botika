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
        {
          key: 'value1',
          label: 'Value 1',
          type: 'text',
          required: true,
          default: '{{ $json.score }}',
          description: 'Nilai atau ekspresi yang akan dibandingkan'
        },
        {
          key: 'comparison',
          label: 'Comparison',
          type: 'select',
          required: true,
          default: 'gt',
          options: [
            { label: 'Equal (==)', value: 'equal' },
            { label: 'Not Equal (!=)', value: 'not_equal' },
            { label: 'Greater Than (>)', value: 'greater_than' },
            { label: 'Less Than (<)', value: 'less_than' },
            { label: 'Greater Than or Equal (>=)', value: 'greater_than_or_equal' },
            { label: 'Less Than or Equal (<=)', value: 'less_than_or_equal' },
            { label: 'Contains', value: 'contains' },
            { label: 'Not Contains', value: 'not_contains' }
          ]
        },
        {
          key: 'value2',
          label: 'Value 2',
          type: 'text',
          required: true,
          default: '0.7',
          description: 'Nilai pembanding'
        }
      ]
    });
  }

  async execute(context, config, node) {
    const input = this.getInput(context, 'input');

    let result = false;
    try {
      const value1 = this.resolveTemplate(config.value1, input);
      const value2 = this.resolveTemplate(config.value2, input);
      result = this.compare(value1, config.comparison || config.expression, value2);
    } catch (err) {
      this.log('error', 'Condition evaluation failed', { error: err.message });
      result = false;
    }

    return {
      expression: `${config.value1} ${config.comparison} ${config.value2}`,
      result,
      routed_to: result ? 'true' : 'false'
    };
  }

  resolveTemplate(value, input) {
    if (typeof value !== 'string') return value;
    return value.replace(/\{\{\s*\$json\.([^}]+)\s*\}\}/g, (_, path) => {
      const resolved = path.split('.').reduce((obj, key) => obj?.[key], input);
      return resolved !== undefined ? resolved : value;
    });
  }

  compare(v1, operator, v2) {
    const n1 = parseFloat(v1);
    const n2 = parseFloat(v2);
    switch (operator) {
      case 'equal':
      case 'eq':
        return String(v1) == String(v2);
      case 'not_equal':
      case 'neq':
        return String(v1) != String(v2);
      case 'greater_than':
      case 'gt':
        return n1 > n2;
      case 'less_than':
      case 'lt':
        return n1 < n2;
      case 'greater_than_or_equal':
      case 'gte':
        return n1 >= n2;
      case 'less_than_or_equal':
      case 'lte':
        return n1 <= n2;
      case 'contains':
        return String(v1).includes(String(v2));
      case 'not_contains':
        return !String(v1).includes(String(v2));
      default:
        return false;
    }
  }
}

module.exports = ConditionNode;
