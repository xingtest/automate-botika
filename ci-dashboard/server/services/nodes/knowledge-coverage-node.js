const BaseNode = require('./base-node');
const { getEnvelope, getItems, normalizeItem, parseList, withResults } = require('./llm-judge-utils');

class KnowledgeCoverageNode extends BaseNode {
  constructor() {
    super({
      type: 'knowledge-coverage',
      category: 'quality',
      label: 'Knowledge Coverage',
      description: 'Measure topic and tag coverage across chatbot test cases',
      icon: 'fa-map',
      color: '#047857',
      inputs: [{ id: 'main', name: 'Test Data', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Coverage Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'required_topics', label: 'Required Topics', type: 'text', required: false, default: '' }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const envelope = getEnvelope(input);
    const requiredTopics = parseList(config.required_topics);
    const results = getItems(input).map(normalizeItem);
    const coveredTopics = [...new Set(results.map(item => item.category || item.title).filter(Boolean).map(String))];
    const missingTopics = requiredTopics.filter(topic => !coveredTopics.some(covered => covered.toLowerCase() === topic.toLowerCase()));
    const duplicates = [];
    const seenQuestions = new Set();
    for (const item of results) {
      const key = String(item.question || '').toLowerCase();
      if (key && seenQuestions.has(key)) duplicates.push(item.question);
      seenQuestions.add(key);
    }
    return withResults(envelope, results, {
      coverage_summary: {
        total_cases: results.length,
        covered_topics: coveredTopics,
        required_topics: requiredTopics,
        missing_topics: missingTopics,
        duplicate_questions: [...new Set(duplicates)],
        coverage_ratio: requiredTopics.length ? Math.round(((requiredTopics.length - missingTopics.length) / requiredTopics.length) * 100) / 100 : 1
      }
    });
  }
}

module.exports = KnowledgeCoverageNode;
