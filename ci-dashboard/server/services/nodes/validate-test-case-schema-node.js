const BaseNode = require('./base-node');
const { getItems, normalizeItem, parseList, withResults } = require('./llm-judge-utils');

class ValidateTestCaseSchemaNode extends BaseNode {
  constructor() {
    super({
      type: 'validate-test-case-schema',
      category: 'quality',
      label: 'Validate Test Case Schema',
      description: 'Validate and normalize chatbot test cases before execution',
      icon: 'fa-list-check',
      color: '#0f766e',
      inputs: [{ id: 'main', name: 'Test Data', dataType: 'object', required: false }],
      outputs: [{ id: 'main', name: 'Validated Data', dataType: 'object', required: true }],
      config_schema: [
        { key: 'required_fields', label: 'Required Fields', type: 'text', required: false, default: 'question,response_kb' },
        { key: 'fail_on_invalid', label: 'Fail on Invalid Rows', type: 'boolean', required: false, default: false }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const requiredFields = parseList(config.required_fields, ['question', 'response_kb']);
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const errors = requiredFields
        .filter(field => !normalized[field] || String(normalized[field]).trim() === '')
        .map(field => `${field} is required`);
      return {
        ...normalized,
        schema_valid: errors.length === 0,
        schema_errors: errors
      };
    });

    const invalidRows = results.filter(item => !item.schema_valid);
    if (config.fail_on_invalid && invalidRows.length > 0) {
      throw new Error(`Invalid test case schema: ${invalidRows.length} row(s) failed validation`);
    }

    return withResults(input, results, {
      schema_validation: {
        valid: invalidRows.length === 0,
        total: results.length,
        invalid: invalidRows.length,
        required_fields: requiredFields
      }
    });
  }
}

module.exports = ValidateTestCaseSchemaNode;
