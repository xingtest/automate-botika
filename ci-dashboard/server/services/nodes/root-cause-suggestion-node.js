const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class RootCauseSuggestionNode extends BaseNode {
  constructor() {
    super({
      type: 'root-cause-suggestion',
      category: 'quality',
      label: 'Root Cause Suggestion',
      description: 'Suggest likely causes and next actions for failed chatbot evaluations',
      icon: 'fa-lightbulb',
      color: '#ca8a04',
      inputs: [{ id: 'main', name: 'Clustered Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Root Cause Results', dataType: 'object', required: true }],
      config_schema: []
    });
  }

  async execute(context) {
    const input = this.getInput(context, 'main') || {};
    const suggestionsByCluster = {
      capture_issue: 'Periksa selector, timeout, pre-chat form, dan apakah response masih loading saat capture.',
      hallucination: 'Periksa retrieval/KB dan instruksi chatbot agar tidak membuat klaim di luar referensi.',
      safety_policy: 'Perkuat guardrail dan refusal policy untuk data sensitif atau instruksi berbahaya.',
      rule_assertion: 'Cek apakah expected answer/must_include sudah lengkap atau bot melewatkan fakta wajib.',
      regression: 'Bandingkan perubahan prompt, model, KB, dan deployment sejak baseline terakhir.',
      flaky: 'Jalankan ulang dengan seed/session berbeda dan cek determinism, latency, atau race condition UI.',
      low_quality_answer: 'Periksa prompt, KB chunking, intent routing, dan threshold judge.'
    };
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const cluster = normalized.failure_cluster || 'passed_or_unclassified';
      return {
        ...normalized,
        root_cause_suggestion: suggestionsByCluster[cluster] || 'Tidak ada tindakan khusus; gunakan hasil detail untuk review manual.'
      };
    });
    const actionItems = [...new Set(results.map(item => item.root_cause_suggestion))];
    return withResults(input, results, { root_cause_summary: { action_items: actionItems } });
  }
}

module.exports = RootCauseSuggestionNode;
