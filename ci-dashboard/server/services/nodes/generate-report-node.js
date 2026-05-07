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

    const input = this.getInput(context, 'test_result') || this.getInput(context, 'input');

    if (!input || (!input.run_id && !input.results)) {
      throw new Error('Invalid input: test results are required to generate a report');
    }

    const format = config.report_format || 'json';
    const baseName = config.output_filename || `report-${Date.now()}`;
    const filename = `${baseName}.${format}`;
    const outputDir = path.join(__dirname, '../../../../artifacts');
    const filePath = path.join(outputDir, filename);

    fs.mkdirSync(outputDir, { recursive: true });

    this.log('info', `Generating ${format} report: ${filename}`);

    if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(input, null, 2));
    } else if (format === 'html') {
      try {
        const ejs = require('ejs');
        const templatePath = path.join(__dirname, '../../../../../template/template.ejs');
        if (fs.existsSync(templatePath)) {
          const template = fs.readFileSync(templatePath, 'utf8');
          const html = ejs.render(template, {
            data: input,
            results: input.results || [],
            title: baseName
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
