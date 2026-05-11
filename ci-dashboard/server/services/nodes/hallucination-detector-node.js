const BaseNode = require('./base-node');
const { getItems, normalizeItem, normalizeText, parseList, similarity, withResults } = require('./llm-judge-utils');

class HallucinationDetectorNode extends BaseNode {
  constructor() {
    super({
      type: 'hallucination-detector',
      category: 'quality',
      label: 'Hallucination Detector',
      description: 'Find unsupported claims and missing expected facts using deterministic checks',
      icon: 'fa-triangle-exclamation',
      color: '#dc2626',
      inputs: [{ id: 'main', name: 'Asserted Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Hallucination Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'claim_similarity_threshold', label: 'Claim Similarity Threshold', type: 'number', required: false, default: 0.15 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const threshold = Number(config.claim_similarity_threshold || 0.15);
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const expected = normalizeText(normalized.response_kb);
      const actual = normalizeText(normalized.response_llm);
      const claims = actual.split(/(?<=[.!?])\s+|\n+/).map(normalizeText).filter(text => text.length > 12);
      const unsupported_claims = claims.filter(claim => similarity(claim, expected) < threshold);
      const mustInclude = parseList(item.must_include);
      const missing_facts = mustInclude.filter(term => !actual.toLowerCase().includes(String(term).toLowerCase()));
      const hasHallucination = unsupported_claims.length > 0 || missing_facts.length > 0;
      return {
        ...normalized,
        hallucination_check: {
          has_hallucination: hasHallucination,
          unsupported_claims,
          missing_facts,
          severity: unsupported_claims.length > 2 ? 'high' : (hasHallucination ? 'medium' : 'none'),
          score: hasHallucination ? Math.max(0, 1 - unsupported_claims.length * 0.2 - missing_facts.length * 0.15) : 1
        }
      };
    });

    return withResults(input, results, {
      hallucination_summary: {
        detected: results.filter(item => item.hallucination_check.has_hallucination).length,
        clean: results.filter(item => !item.hallucination_check.has_hallucination).length
      }
    });
  }
}

module.exports = HallucinationDetectorNode;
