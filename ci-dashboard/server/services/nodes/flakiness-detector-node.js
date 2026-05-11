const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class FlakinessDetectorNode extends BaseNode {
  constructor() {
    super({
      type: 'flakiness-detector',
      category: 'quality',
      label: 'Flakiness Detector',
      description: 'Detect inconsistent pass/fail or score variance for repeated questions',
      icon: 'fa-wave-square',
      color: '#ea580c',
      inputs: [{ id: 'main', name: 'Judged Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Flakiness Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'variance_threshold', label: 'Variance Threshold', type: 'number', required: false, default: 0.2 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const threshold = Number(config.variance_threshold ?? 0.2);
    const normalizedItems = getItems(input).map(normalizeItem);
    const groups = new Map();
    for (const item of normalizedItems) {
      const key = String(item.question || item.title || item.no).toLowerCase();
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    }
    const stats = {};
    for (const [key, rows] of groups.entries()) {
      const scores = rows.map(row => Number(row.ai_score ?? row.skor ?? row.consensus_judgement?.score ?? 0));
      const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      const variance = scores.reduce((sum, score) => sum + Math.abs(score - avg), 0) / scores.length;
      const passValues = new Set(rows.map(row => Boolean(row.ai_passed ?? row.status === 'PASS' ?? row.status === 'pass')));
      stats[key] = {
        runs: rows.length,
        average_score: Math.round(avg * 100) / 100,
        variance: Math.round(variance * 100) / 100,
        flaky: rows.length > 1 && (variance >= threshold || passValues.size > 1)
      };
    }
    const results = normalizedItems.map(item => ({
      ...item,
      flakiness: stats[String(item.question || item.title || item.no).toLowerCase()]
    }));
    return withResults(input, results, {
      flakiness_summary: {
        repeated_groups: Object.values(stats).filter(stat => stat.runs > 1).length,
        flaky_groups: Object.values(stats).filter(stat => stat.flaky).length
      }
    });
  }
}

module.exports = FlakinessDetectorNode;
