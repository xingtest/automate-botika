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
          description: 'Format file laporan yang akan dibuat',
          options: [
            { label: 'JSON', value: 'json' },
            { label: 'HTML', value: 'html' },
            { label: 'Excel', value: 'excel' }
          ]
        },
        {
          key: 'output_filename',
          label: 'Output Filename',
          type: 'text',
          required: true,
          default: 'report',
          description: 'Nama file laporan tanpa ekstensi'
        },
        {
          key: 'include_screenshots',
          label: 'Include Screenshots',
          type: 'boolean',
          required: false,
          default: false
        }
      ]
    });
  }

  async execute(context, config, node) {
    const fs = require('fs');
    const path = require('path');

    const input = this.getInput(context, 'main') || this.getInput(context, 'test_result') || this.getInput(context, 'input');

    if (!input || (!input.run_id && !input.results && !input.evaluations)) {
      throw new Error('Invalid input: test results are required to generate a report');
    }

    const format = config.report_format || 'json';
    const baseName = config.output_filename || `report-${Date.now()}`;
    const filename = `${baseName}.${format}`;
    const outputDir = path.join(__dirname, '../../../../artifacts');
    const filePath = path.join(outputDir, filename);

    fs.mkdirSync(outputDir, { recursive: true });

    this.log('info', `Generating ${format} report: ${filename}`);

    // Standardize input data for the template
    const rawResults = input.results || input.evaluations || [];
    const runId = input.run_id || `WF-${Date.now()}`;
    const startTime = input.start_time || new Date().toISOString();
    
    // Map data to match template/template.ejs expectations
    const test_data = rawResults.map((item, index) => ({
      no: index + 1,
      id: item.id || `T-${index + 1}`,
      title: item.title || item.topic || 'General',
      question: item.question || 'N/A',
      response_kb: item.expected_answer || item.expected || 'N/A',
      response_llm: item.bot_response || item.response || 'N/A',
      explanation: item.ai_explanation || item.explanation || 'N/A',
      status: item.ai_passed ? 'PASS' : 'FAILED',
      skor: item.ai_score !== undefined ? item.ai_score : (item.score || 0),
      duration: item.duration || '00:00:01',
      image_capture: item.image_capture || null
    }));

    const passedCount = test_data.filter(i => i.status === 'PASS').length;
    const failedCount = test_data.length - passedCount;
    const totalDuration = test_data.reduce((acc, curr) => acc + 1, 0); // Placeholder duration logic

    const summary = [{
      id_test: runId,
      success: passedCount,
      failed: failedCount,
      total_title: [...new Set(test_data.map(i => i.title))].length,
      total_question: test_data.length,
      duration: `${totalDuration}s`,
      tester_name: 'AI Judge (Workflow)',
      date_test: new Date().toLocaleDateString(),
      ai_evaluation: 'Enabled',
      browser_name: 'Headless',
      url: 'Workflow Execution',
      start_time_test: startTime,
      end_time_test: new Date().toISOString()
    }];

    if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(input, null, 2));
    } else if (format === 'html') {
      try {
        const ejs = require('ejs');
        const templatePath = path.resolve(process.cwd(), 'template/template.ejs');
        this.log('info', `Loading template from: ${templatePath}`);
        
        if (fs.existsSync(templatePath)) {
          const template = fs.readFileSync(templatePath, 'utf8');
          const html = ejs.render(template, {
            summary,
            test_data
          });
          fs.writeFileSync(filePath, html);
        } else {
          // Fallback: simple HTML
          const html = `<!DOCTYPE html><html><head><title>${baseName}</title></head><body><pre>${JSON.stringify(input, null, 2)}</pre></body></html>`;
          fs.writeFileSync(filePath, html);
        }
      } catch (e) {
        this.log('warn', `EJS rendering failed, using simple HTML fallback: ${e.message}`);
        const html = `<!DOCTYPE html><html><head><title>${baseName}</title></head><body><pre>${JSON.stringify(input, null, 2)}</pre></body></html>`;
        fs.writeFileSync(filePath, html);
      }
    } else if (format === 'excel') {
      // Fallback to JSON if excel generator not available
      const jsonPath = filePath.replace('.excel', '.json');
      fs.writeFileSync(jsonPath, JSON.stringify(input, null, 2));
    }

    const fileSize = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0;

    // Store artifact in database
    const result = await db.queryOriginal(
      `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.run_id || null,
        format,
        filename,
        filePath,
        fileSize,
        `Workflow generated ${format} report`
      ]
    );

    const artifactId = result.rows[0].id;

    return {
      artifact_id: artifactId,
      filename,
      file_path: filePath,
      file_size: fileSize,
      download_url: `/api/artifacts/${artifactId}/download`,
      format
    };
  }
}

module.exports = GenerateReportNode;
