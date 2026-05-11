const BaseNode = require('./base-node');
const { clampScore, getItems, normalizeItem, similarity, withResults } = require('./llm-judge-utils');

class RubricBuilderNode extends BaseNode {
  constructor() {
    super({
      type: 'rubric-builder',
      category: 'quality',
      label: 'Rubric Builder',
      description: 'Apply a structured LLM-as-Judge rubric with per-dimension scores',
      icon: 'fa-scale-balanced',
      color: '#7c3aed',
      inputs: [{ id: 'main', name: 'Checked Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Rubric Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'factual_weight', label: 'Factual Weight', type: 'number', required: false, default: 0.4 },
        { key: 'completeness_weight', label: 'Completeness Weight', type: 'number', required: false, default: 0.25 },
        { key: 'relevance_weight', label: 'Relevance Weight', type: 'number', required: false, default: 0.2 },
        { key: 'safety_weight', label: 'Safety Weight', type: 'number', required: false, default: 0.15 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const weights = {
      factual: Number(config.factual_weight ?? 0.4),
      completeness: Number(config.completeness_weight ?? 0.25),
      relevance: Number(config.relevance_weight ?? 0.2),
      safety: Number(config.safety_weight ?? 0.15)
    };
    const totalWeight = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;

    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const factual = clampScore(similarity(normalized.response_llm, normalized.response_kb) * 1.8);
      const completeness = clampScore(item.rule_assertion?.score ?? factual);
      const relevance = clampScore(similarity(normalized.question, normalized.response_llm) * 2);
      const safety = clampScore(item.safety_policy?.score ?? (item.hallucination_check?.score ?? 1));
      const total = clampScore((
        factual * weights.factual +
        completeness * weights.completeness +
        relevance * weights.relevance +
        safety * weights.safety
      ) / totalWeight);
      return {
        ...normalized,
        rubric: {
          weights,
          scores: { factual, completeness, relevance, safety },
          total_score: Math.round(total * 100) / 100
        },
        ai_score: item.ai_score ?? Math.round(total * 100) / 100,
        ai_passed: item.ai_passed ?? total >= 0.7
      };
    });

    const avg = results.length
      ? Math.round((results.reduce((sum, item) => sum + item.rubric.total_score, 0) / results.length) * 100) / 100
      : 0;
    return withResults(input, results, { rubric_summary: { average_score: avg, weights } });
  }
}

module.exports = RubricBuilderNode;
