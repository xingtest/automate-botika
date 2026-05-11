const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class CIGateNode extends BaseNode {
  constructor() {
    super({
      type: 'ci-gate',
      category: 'quality',
      label: 'CI Gate',
      description: 'Create a final pass/fail decision for CI based on score, failures, hallucination, and flakiness',
      icon: 'fa-shield-halved',
      color: '#0f172a',
      inputs: [{ id: 'main', name: 'Analyzed Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Gate Result', dataType: 'object', required: true }],
      config_schema: [
        { key: 'minimum_average_score', label: 'Minimum Average Score', type: 'number', required: false, default: 0.75 },
        { key: 'allow_hallucination', label: 'Allow Hallucination', type: 'boolean', required: false, default: false },
        { key: 'allow_flaky', label: 'Allow Flaky Tests', type: 'boolean', required: false, default: false }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const minAverage = Number(config.minimum_average_score ?? 0.75);
    const results = getItems(input).map(normalizeItem);
    const scores = results.map(item => Number(item.ai_score ?? item.skor ?? item.consensus_judgement?.score ?? 0));
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const failed = results.filter(item => {
      if (item.consensus_judgement) return !item.consensus_judgement.passed;
      if (item.ai_passed !== undefined) return !item.ai_passed;
      return String(item.status || '').toLowerCase() === 'failed';
    });
    const hallucinations = results.filter(item => item.hallucination_check?.has_hallucination);
    const flaky = results.filter(item => item.flakiness?.flaky);
    const reasons = [];
    if (average < minAverage) reasons.push(`average_score_below_${minAverage}`);
    if (failed.length > 0) reasons.push('failed_tests_present');
    if (!config.allow_hallucination && hallucinations.length > 0) reasons.push('hallucination_detected');
    if (!config.allow_flaky && flaky.length > 0) reasons.push('flaky_tests_detected');
    const passed = reasons.length === 0;
    return withResults(input, results, {
      ci_gate: {
        passed,
        status: passed ? 'PASS' : 'FAILED',
        average_score: Math.round(average * 100) / 100,
        total: results.length,
        failed: failed.length,
        hallucinations: hallucinations.length,
        flaky: flaky.length,
        reasons
      },
      status: passed ? 'completed' : 'failed'
    });
  }
}

module.exports = CIGateNode;
