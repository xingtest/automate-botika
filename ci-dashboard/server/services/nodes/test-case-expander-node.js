const BaseNode = require('./base-node');
const { getItems, normalizeItem, parseList, withResults } = require('./llm-judge-utils');

class TestCaseExpanderNode extends BaseNode {
  constructor() {
    super({
      type: 'test-case-expander',
      category: 'quality',
      label: 'Test Case Expander',
      description: 'Create robust question variants for GenAI chatbot testing',
      icon: 'fa-up-right-and-down-left-from-center',
      color: '#0d9488',
      inputs: [{ id: 'main', name: 'Test Data', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Expanded Test Data', dataType: 'object', required: true }],
      config_schema: [
        { key: 'modes', label: 'Variant Modes', type: 'text', required: false, default: 'casual,typo,short' },
        { key: 'append_original', label: 'Append Original', type: 'boolean', required: false, default: true }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const modes = parseList(config.modes, ['casual', 'typo', 'short']);
    const originals = getItems(input).map(normalizeItem);
    const variants = [];
    for (const item of originals) {
      for (const mode of modes) {
        variants.push({
          ...item,
          no: `${item.no}-${mode}`,
          title: `${item.title} (${mode})`,
          question: this.variantQuestion(item.question, mode),
          variant_of: item.no,
          variant_mode: mode
        });
      }
    }
    const results = config.append_original === false ? variants : [...originals, ...variants];
    return withResults(input, results, {
      expansion_summary: {
        original: originals.length,
        variants: variants.length,
        modes
      }
    });
  }

  variantQuestion(question, mode) {
    const text = String(question || '').trim();
    if (mode === 'casual') return `${text} ya?`;
    if (mode === 'typo') return text.replace(/[aiueo]/i, '').replace(/\s+/g, ' ');
    if (mode === 'short') return text.split(/\s+/).slice(0, 5).join(' ');
    if (mode === 'english_mix') return `Can you explain: ${text}`;
    if (mode === 'angry_user') return `Tolong jawab yang jelas, ${text}`;
    return text;
  }
}

module.exports = TestCaseExpanderNode;
