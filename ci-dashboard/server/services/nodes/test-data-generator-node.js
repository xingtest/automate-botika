const BaseNode = require('./base-node');
const { getEnvelope, getItems, normalizeText, withResults } = require('./llm-judge-utils');

class TestDataGeneratorNode extends BaseNode {
  constructor() {
    super({
      type: 'test-data-generator',
      category: 'quality',
      label: 'Test Data Generator',
      description: 'Generate starter chatbot test cases from knowledge base text',
      icon: 'fa-wand-magic-sparkles',
      color: '#7c2d12',
      inputs: [{ id: 'main', name: 'Knowledge Base', dataType: 'object', required: false }],
      outputs: [{ id: 'main', name: 'Generated Test Data', dataType: 'object', required: true }],
      config_schema: [
        { key: 'knowledge_base_text', label: 'Knowledge Base Text', type: 'textarea', required: false, default: '' },
        { key: 'max_cases', label: 'Max Cases', type: 'number', required: false, default: 5 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const envelope = getEnvelope(input);
    const existing = getItems(input);
    const kb = normalizeText(config.knowledge_base_text || envelope.knowledge_base_text || envelope.context || '');
    const sentences = kb.split(/(?<=[.!?])\s+|\n+/).map(normalizeText).filter(text => text.length > 20);
    const generated = sentences.slice(0, Number(config.max_cases || 5)).map((sentence, index) => ({
      no: `GEN-${index + 1}`,
      title: 'Generated From KB',
      category: 'generated',
      question: `Apa informasi penting tentang: ${sentence.slice(0, 60)}?`,
      response_kb: sentence,
      must_include: sentence.split(/\s+/).filter(word => word.length > 5).slice(0, 3),
      generated_by: 'test-data-generator'
    }));
    return withResults(envelope, existing.length ? existing : generated, {
      generated_test_cases: generated,
      generator_summary: { generated: generated.length, used_as_results: existing.length === 0 }
    });
  }
}

module.exports = TestDataGeneratorNode;
