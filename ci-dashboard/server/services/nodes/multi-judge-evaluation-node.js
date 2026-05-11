const BaseNode = require('./base-node');
const { clampScore, getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class MultiJudgeEvaluationNode extends BaseNode {
  constructor() {
    super({
      type: 'multi-judge-evaluation',
      category: 'quality',
      label: 'Multi Judge Evaluation',
      description: 'Aggregate rubric, rule, capture, hallucination, and AI judge scores',
      icon: 'fa-users-gear',
      color: '#9333ea',
      inputs: [{ id: 'main', name: 'Judged Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Consensus Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'threshold', label: 'Pass Threshold', type: 'number', required: false, default: 0.7 },
        { key: 'disagreement_threshold', label: 'Disagreement Threshold', type: 'number', required: false, default: 0.25 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const threshold = Number(config.threshold ?? 0.7);
    const disagreementThreshold = Number(config.disagreement_threshold ?? 0.25);
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const judges = [
        { name: 'rubric', score: item.rubric?.total_score },
        { name: 'rule_assertion', score: item.rule_assertion?.score },
        { name: 'capture_quality', score: item.capture_quality?.score },
        { name: 'hallucination', score: item.hallucination_check?.score },
        { name: 'ai', score: item.ai_score }
      ].filter(judge => Number.isFinite(Number(judge.score)))
       .map(judge => ({ ...judge, score: clampScore(judge.score) }));
      const average = judges.length ? judges.reduce((sum, judge) => sum + judge.score, 0) / judges.length : 0;
      const max = judges.length ? Math.max(...judges.map(judge => judge.score)) : 0;
      const min = judges.length ? Math.min(...judges.map(judge => judge.score)) : 0;
      const disagreement = max - min;
      return {
        ...normalized,
        consensus_judgement: {
          score: Math.round(average * 100) / 100,
          passed: average >= threshold,
          confidence: Math.round((1 - Math.min(1, disagreement)) * 100) / 100,
          disagreement: Math.round(disagreement * 100) / 100,
          needs_review: disagreement >= disagreementThreshold,
          judges
        },
        ai_score: Math.round(average * 100) / 100,
        ai_passed: average >= threshold
      };
    });

    return withResults(input, results, {
      consensus_summary: {
        passed: results.filter(item => item.consensus_judgement.passed).length,
        failed: results.filter(item => !item.consensus_judgement.passed).length,
        needs_review: results.filter(item => item.consensus_judgement.needs_review).length
      }
    });
  }
}

module.exports = MultiJudgeEvaluationNode;
