const BaseNode = require('./base-node');
const { getItems, normalizeItem, normalizeText, parseList, withResults } = require('./llm-judge-utils');

class RuleAssertionNode extends BaseNode {
  constructor() {
    super({
      type: 'rule-assertion',
      category: 'quality',
      label: 'Rule Assertion',
      description: 'Run deterministic must-include and must-not-include assertions',
      icon: 'fa-check-double',
      color: '#16a34a',
      inputs: [{ id: 'main', name: 'Test Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Asserted Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'must_include', label: 'Global Must Include', type: 'text', required: false, default: '' },
        { key: 'must_not_include', label: 'Global Must Not Include', type: 'text', required: false, default: '' },
        { key: 'case_sensitive', label: 'Case Sensitive', type: 'boolean', required: false, default: false }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const globalMust = parseList(config.must_include);
    const globalMustNot = parseList(config.must_not_include);
    const caseSensitive = !!config.case_sensitive;
    const prep = value => caseSensitive ? normalizeText(value) : normalizeText(value).toLowerCase();

    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const actual = prep(normalized.response_llm);
      const mustInclude = [...globalMust, ...parseList(item.must_include)];
      const mustNotInclude = [...globalMustNot, ...parseList(item.must_not_include)];
      const missing = mustInclude.filter(term => !actual.includes(prep(term)));
      const forbidden = mustNotInclude.filter(term => actual.includes(prep(term)));
      const passed = missing.length === 0 && forbidden.length === 0;
      return {
        ...normalized,
        rule_assertion: {
          passed,
          missing,
          forbidden,
          score: passed ? 1 : Math.max(0, 1 - (missing.length + forbidden.length) * 0.25)
        }
      };
    });

    return withResults(input, results, {
      rule_assertion_summary: {
        passed: results.filter(item => item.rule_assertion.passed).length,
        failed: results.filter(item => !item.rule_assertion.passed).length
      }
    });
  }
}

module.exports = RuleAssertionNode;
