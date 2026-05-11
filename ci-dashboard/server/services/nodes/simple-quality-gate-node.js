const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class SimpleQualityGateNode extends BaseNode {
  constructor() {
    super({
      type: 'simple-quality-gate',
      category: 'simple',
      label: 'Quality Gate',
      description: 'Decide CI pass/fail and add failure clusters plus root-cause suggestions',
      icon: 'fa-shield-halved',
      color: '#0f172a',
      inputs: [{ id: 'main', name: 'Judged Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Quality Gate Result', dataType: 'object', required: true }],
      config_schema: [
        { key: 'minimum_average_score', label: 'Minimum Average Score', type: 'number', required: false, default: 0.75 },
        { key: 'allow_hallucination', label: 'Allow Hallucination', type: 'boolean', required: false, default: false }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const minAverage = Number(config.minimum_average_score ?? 0.75);
    const suggestions = {
      capture_issue: 'Periksa selector, timeout, pre-chat form, dan apakah response masih loading saat capture.',
      hallucination: 'Periksa retrieval/KB dan instruksi chatbot agar tidak membuat klaim di luar referensi.',
      safety_policy: 'Perkuat guardrail dan refusal policy untuk data sensitif atau instruksi berbahaya.',
      rule_assertion: 'Cek expected answer atau fakta wajib yang belum disebut bot.',
      low_quality_answer: 'Periksa prompt, KB chunking, intent routing, dan threshold judge.',
      passed_or_unclassified: 'Tidak ada tindakan khusus.'
    };
    const clusterCounts = {};
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const cluster = this.cluster(normalized);
      clusterCounts[cluster] = (clusterCounts[cluster] || 0) + 1;
      return { ...normalized, failure_cluster: cluster, root_cause_suggestion: suggestions[cluster] };
    });

    const scores = results.map(row => Number(row.ai_score ?? row.consensus_judgement?.score ?? 0));
    const average = scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const failed = results.filter(row => row.consensus_judgement?.passed === false || row.ai_passed === false);
    const hallucinations = results.filter(row => row.hallucination_check?.has_hallucination);
    const reasons = [];
    if (average < minAverage) reasons.push(`average_score_below_${minAverage}`);
    if (failed.length) reasons.push('failed_tests_present');
    if (config.allow_hallucination !== true && hallucinations.length) reasons.push('hallucination_detected');
    const passed = reasons.length === 0;

    return withResults(input, results, {
      ci_gate: {
        passed,
        status: passed ? 'PASS' : 'FAILED',
        average_score: Math.round(average * 100) / 100,
        total: results.length,
        failed: failed.length,
        hallucinations: hallucinations.length,
        flaky: 0,
        reasons
      },
      failure_clusters: Object.fromEntries(Object.entries(clusterCounts).map(([name, count]) => [name, { count }])),
      root_cause_summary: {
        action_items: [...new Set(results.map(row => row.root_cause_suggestion))]
      },
      status: passed ? 'completed' : 'failed'
    });
  }

  cluster(item) {
    if (item.capture_quality && !item.capture_quality.valid) return 'capture_issue';
    if (item.hallucination_check?.has_hallucination) return 'hallucination';
    if (item.safety_policy && !item.safety_policy.passed) return 'safety_policy';
    if (item.rule_assertion && !item.rule_assertion.passed) return 'rule_assertion';
    if (item.ai_passed === false || item.consensus_judgement?.passed === false) return 'low_quality_answer';
    return 'passed_or_unclassified';
  }
}

module.exports = SimpleQualityGateNode;
