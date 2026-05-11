const BaseNode = require('./base-node');
const GenerateReportNode = require('./generate-report-node');

class SimpleGenAIReportNode extends BaseNode {
  constructor() {
    super({
      type: 'simple-genai-report',
      category: 'simple',
      label: 'GenAI Report',
      description: 'Generate an actionable GenAI LLM-as-Judge HTML report',
      icon: 'fa-file-lines',
      color: '#10b981',
      inputs: [{ id: 'main', name: 'Quality Gate Result', dataType: 'object', required: true }],
      outputs: [{ id: 'main', name: 'Report Artifact', dataType: 'object', required: true }],
      config_schema: [
        { key: 'output_filename', label: 'Output Filename', type: 'text', required: false, default: 'simple-genai-llm-judge-report' }
      ]
    });
  }

  async execute(context, config, node) {
    const input = this.getInput(context, 'main') || {};
    const reportNode = new GenerateReportNode();
    const reportContext = {
      ...context,
      current_node_id: context.current_node_id,
      getInput: () => input
    };
    return reportNode.execute(reportContext, {
      report_format: 'html',
      report_style: 'genai',
      output_filename: config.output_filename || 'simple-genai-llm-judge-report'
    }, node);
  }
}

module.exports = SimpleGenAIReportNode;
