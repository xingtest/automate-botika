const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class FailureClusteringNode extends BaseNode {
  constructor() {
    super({
      type: 'failure-clustering',
      category: 'quality',
      label: 'Failure Clustering',
      description: 'Group failed chatbot tests by likely failure pattern',
      icon: 'fa-layer-group',
      color: '#c2410c',
      inputs: [{ id: 'main', name: 'Analyzed Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Clustered Results', dataType: 'object', required: true }],
      config_schema: []
    });
  }

  async execute(context) {
    const input = this.getInput(context, 'main') || {};
    const clusters = {};
    const classify = item => {
      if (item.capture_quality && !item.capture_quality.valid) return 'capture_issue';
      if (item.hallucination_check?.has_hallucination) return 'hallucination';
      if (item.safety_policy && !item.safety_policy.passed) return 'safety_policy';
      if (item.rule_assertion && !item.rule_assertion.passed) return 'rule_assertion';
      if (item.baseline_comparison?.regressed) return 'regression';
      if (item.flakiness?.flaky) return 'flaky';
      if (item.ai_passed === false || item.consensus_judgement?.passed === false) return 'low_quality_answer';
      return 'passed_or_unclassified';
    };
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const cluster = classify(normalized);
      if (!clusters[cluster]) clusters[cluster] = [];
      clusters[cluster].push(normalized.no);
      return { ...normalized, failure_cluster: cluster };
    });
    return withResults(input, results, {
      failure_clusters: Object.fromEntries(Object.entries(clusters).map(([key, value]) => [key, { count: value.length, items: value }]))
    });
  }
}

module.exports = FailureClusteringNode;
