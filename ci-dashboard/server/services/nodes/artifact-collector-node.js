const BaseNode = require('./base-node');
const { getItems, normalizeItem, withResults } = require('./llm-judge-utils');

class ArtifactCollectorNode extends BaseNode {
  constructor() {
    super({
      type: 'artifact-collector',
      category: 'quality',
      label: 'Artifact Collector',
      description: 'Collect screenshots, transcripts, raw judge data, and debug artifacts into one payload',
      icon: 'fa-box-archive',
      color: '#475569',
      inputs: [{ id: 'main', name: 'Analyzed Results', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Artifact Payload', dataType: 'object', required: true }],
      config_schema: []
    });
  }

  async execute(context) {
    const input = this.getInput(context, 'main') || {};
    const results = getItems(input).map(normalizeItem);
    const artifacts = results.map(item => ({
      no: item.no,
      title: item.title,
      screenshot: item.image_capture || null,
      transcript: item.transcript || item.turns || null,
      raw_actual: item.response_llm,
      judge: {
        rubric: item.rubric || null,
        consensus: item.consensus_judgement || null,
        hallucination: item.hallucination_check || null,
        safety: item.safety_policy || null
      }
    }));
    return withResults(input, results, {
      artifacts_collected: artifacts,
      artifact_summary: { total: artifacts.length, screenshots: artifacts.filter(item => item.screenshot).length }
    });
  }
}

module.exports = ArtifactCollectorNode;
