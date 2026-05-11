const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class JudgePromptVersionNode extends BaseNode {
  constructor() {
    super({
      type: 'judge-prompt-version',
      category: 'quality',
      label: 'Judge Prompt Version',
      description: 'Attach judge prompt, model, threshold, and version metadata to results',
      icon: 'fa-code-compare',
      color: '#4f46e5',
      inputs: [{ id: 'main', name: 'Judged Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Versioned Results', dataType: 'object', required: true }],
      config_schema: [
        { key: 'version', label: 'Prompt Version', type: 'text', required: false, default: 'judge-v1' },
        { key: 'provider', label: 'Provider', type: 'text', required: false, default: 'local-rubric' },
        { key: 'model', label: 'Model', type: 'text', required: false, default: 'deterministic' },
        { key: 'threshold', label: 'Threshold', type: 'number', required: false, default: 0.7 }
      ]
    });
  }

  async execute(context, config) {
    const input = this.getInput(context, 'main') || {};
    const metadata = {
      version: config.version || 'judge-v1',
      provider: config.provider || 'local-rubric',
      model: config.model || 'deterministic',
      threshold: Number(config.threshold ?? 0.7),
      recorded_at: new Date().toISOString()
    };
    const results = getItems(input).map((item, index) => ({
      ...normalizeItem(item, index),
      judge_metadata: metadata
    }));
    return withResults(input, results, { judge_metadata: metadata });
  }
}

module.exports = JudgePromptVersionNode;
