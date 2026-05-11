const BaseNode = require('./base-node');
const { getItems, normalizeItem, normalizeText, withResults } = require('./llm-judge-utils');

class ResponseCaptureQualityNode extends BaseNode {
  constructor() {
    super({
      type: 'response-capture-quality',
      category: 'quality',
      label: 'Response Capture Quality',
      description: 'Detect empty, stale, loading, or user-echo responses before judging',
      icon: 'fa-magnifying-glass-chart',
      color: '#2563eb',
      inputs: [{ id: 'main', name: 'Test Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Checked Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'min_length', label: 'Minimum Actual Length', type: 'number', required: false, default: 8 },
        { key: 'loading_terms', label: 'Loading Terms', type: 'text', required: false, default: 'typing,loading,please wait,sebentar' }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const minLength = Number(config.min_length || 8);
    const loadingTerms = String(config.loading_terms || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const actual = normalizeText(normalized.response_llm);
      const question = normalizeText(normalized.question);
      const issues = [];
      if (!actual || /no response captured|error capturing response/i.test(actual)) issues.push('no_response');
      if (actual.length > 0 && actual.length < minLength) issues.push('too_short');
      if (question && actual.toLowerCase() === question.toLowerCase()) issues.push('echoed_question');
      if (loadingTerms.some(term => actual.toLowerCase().includes(term))) issues.push('still_loading');
      const score = issues.length === 0 ? 1 : Math.max(0, 1 - issues.length * 0.25);
      return {
        ...normalized,
        capture_quality: {
          valid: issues.length === 0,
          score,
          issues
        }
      };
    });

    return withResults(input, results, {
      capture_quality_summary: {
        valid: results.filter(item => item.capture_quality.valid).length,
        invalid: results.filter(item => !item.capture_quality.valid).length
      }
    });
  }
}

module.exports = ResponseCaptureQualityNode;
