const BaseNode = require('./base-node');
const { pool: db } = require('../../db');

class GenerateReportNode extends BaseNode {
  constructor() {
    super({
      type: 'generate-report',
      category: 'action',
      label: 'Generate Report',
      description: 'Create test reports in various formats',
      icon: 'fa-file-alt',
      color: '#8b5cf6',
      inputs: [
        { id: 'test_result', name: 'Test Result', dataType: 'object', required: true }
      ],
      outputs: [
        { id: 'artifact', name: 'Artifact', dataType: 'object', required: true }
      ],
      config_schema: [
        { 
          key: 'report_format', 
          label: 'Report Format', 
          type: 'select', 
          required: true,
          options: [
            { label: 'JSON', value: 'json' },
            { label: 'HTML', value: 'html' },
            { label: 'Excel', value: 'excel' }
          ]
        },
        { key: 'output_filename', label: 'Output Filename', type: 'text', required: true, default: 'report' },
        { key: 'include_screenshots', label: 'Include Screenshots', type: 'boolean', required: false, default: false }
      ]
    });
  }
  
  async execute(context, config, node) {
    const input = this.getInput(context, 'test_result');
    
    if (!input || !input.run_id) {
      throw new Error('Invalid test result input');
    }
    
    // This is a placeholder implementation
    // In production, this would integrate with src/utils/report-generator.ts
    
    this.log('info', `Generating ${config.report_format} report`);
    
    const filename = `${config.output_filename}.${config.report_format}`;
    const filePath = `/reports/${filename}`;
    
    // Store artifact in database
    const result = await db.queryOriginal(
      `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.run_id,
        config.report_format,
        filename,
        filePath,
        0,
        `Workflow generated ${config.report_format} report`
      ]
    );
    
    const artifactId = result.rows[0].id;
    
    return {
      artifact_id: artifactId,
      filename: filename,
      file_path: filePath,
      file_size: 0,
      download_url: `/api/artifacts/${artifactId}/download`,
      format: config.report_format
    };
  }
}

module.exports = GenerateReportNode;
