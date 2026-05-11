const BaseNode = require('./base-node');
const { pool: db } = require('../../db');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class BaselineComparisonNode extends BaseNode {
  constructor() {
    super({
      type: 'baseline-comparison',
      category: 'quality',
      label: 'Baseline Comparison',
      description: 'Compare current results with previous saved test results',
      icon: 'fa-chart-line',
      color: '#0891b2',
      inputs: [{ id: 'main', name: 'Judged Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Compared Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'score_regression_threshold', label: 'Regression Threshold', type: 'number', required: false, default: 0.15 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const threshold = Number(config.score_regression_threshold ?? 0.15);
    const previous = await db.queryOriginal(
      `SELECT DISTINCT ON (question) question, skor, status, response_llm, created_at
       FROM test_results
       WHERE question IS NOT NULL
       ORDER BY question, created_at DESC
       LIMIT 500`
    ).catch(() => ({ rows: [] }));
    const baseline = new Map(previous.rows.map(row => [String(row.question || '').trim().toLowerCase(), row]));
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const old = baseline.get(String(normalized.question || '').trim().toLowerCase());
      const currentScore = Number(item.ai_score ?? item.skor ?? item.consensus_judgement?.score ?? 0);
      const oldScore = old ? Number(old.skor || 0) : null;
      const delta = old ? Math.round((currentScore - oldScore) * 100) / 100 : null;
      return {
        ...normalized,
        baseline_comparison: {
          has_baseline: !!old,
          previous_score: oldScore,
          current_score: currentScore,
          delta,
          regressed: old ? delta <= -threshold : false,
          previous_status: old?.status || null
        }
      };
    });
    return withResults(input, results, {
      baseline_summary: {
        compared: results.filter(item => item.baseline_comparison.has_baseline).length,
        regressed: results.filter(item => item.baseline_comparison.regressed).length
      }
    });
  }
}

module.exports = BaselineComparisonNode;
