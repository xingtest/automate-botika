const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class ConversationScenarioNode extends BaseNode {
  constructor() {
    super({
      type: 'conversation-scenario',
      category: 'quality',
      label: 'Conversation Scenario',
      description: 'Normalize single-turn or multi-turn chatbot tests into scenario transcripts',
      icon: 'fa-comments',
      color: '#2563eb',
      inputs: [{ id: 'main', name: 'Test Data', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Scenario Data', dataType: 'object', required: true }],
      config_schema: []
    });
  }

  async execute(context) {
    const input = this.getInput(context, 'main') || {};
    const results = getItems(input).map((item, index) => {
      const normalized = normalizeItem(item, index);
      const turns = Array.isArray(item.turns) ? item.turns : [{
        user: normalized.question,
        expected: normalized.response_kb,
        bot: normalized.response_llm || ''
      }];
      return {
        ...normalized,
        scenario_id: item.scenario_id || `SCN-${index + 1}`,
        turns,
        turn_count: turns.length
      };
    });
    return withResults(input, results, {
      scenario_summary: {
        scenarios: results.length,
        total_turns: results.reduce((sum, item) => sum + item.turn_count, 0)
      }
    });
  }
}

module.exports = ConversationScenarioNode;
