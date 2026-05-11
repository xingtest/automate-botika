const BaseNode = require('./base-node');
const { pool: db } = require('../../db');
const fs = require('fs');
const path = require('path');

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
        { id: 'main', name: 'Test Result', dataType: 'object', required: true }
      ],
      outputs: [
        { id: 'main', name: 'Artifact', dataType: 'object', required: true }
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
    const input = this.getInput(context, 'main');

    if (!input || (!input.run_id && !input.results && !input.evaluations)) {
      throw new Error('Invalid input: test results are required to generate a report');
    }

    const format = config.report_format || 'json';
    const baseName = config.output_filename || `report-${Date.now()}`;
    const filename = `${baseName}.${format}`;
    
    // Move output to ci-dashboard/artifacts/
    const ciDashboardDir = path.join(__dirname, '../../..');
    const outputDir = path.join(ciDashboardDir, 'artifacts');
    const filePath = path.join(outputDir, filename);

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    this.log('info', `Generating ${format} report: ${filename}`);

    // Standardize input data for the template
    const rawResults = input.results || input.evaluations || [];
    const runId = input.run_id || `WF-${Date.now()}`;
    const startTime = input.start_time || new Date().toISOString();
    
    // Map data to match template/template.ejs expectations
    const test_data = rawResults.map((item, index) => ({
      no: item.no || index + 1,
      id: item.id || `T-${index + 1}`,
      title: item.title || item.topic || 'General',
      question: item.question || 'N/A',
      response_kb: item.response_kb || item.expected_answer || item.expected || 'N/A',
      response_llm: item.response_llm || item.bot_response || item.actual || item.response || 'N/A',
      explanation: item.ai_explanation || item.explanation || 'N/A',
      status: (item.ai_passed !== undefined ? item.ai_passed : item.status === 'pass') ? 'PASS' : 'FAILED',
      skor: item.ai_score !== undefined ? item.ai_score : (item.skor !== undefined ? item.skor : (item.score || 0)),
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
    // Relative path for database and dashboard access (relative to ci-dashboard root)
    const relativePath = `artifacts/${filename}`;

    let finalRunId = input.run_id;
    const evaluations = input.evaluations || [];
    const resultsData = input.results || evaluations;
    const totalEvaluated = evaluations.length || (input.results ? input.results.length : 0);
    const runPassedCount = evaluations.filter(i => i.ai_passed).length;
    const runFailedCount = totalEvaluated - runPassedCount;
    const avgScore = evaluations.length > 0
      ? Math.round((evaluations.reduce((sum, item) => sum + (item.ai_score || 0), 0) / evaluations.length) * 100) / 100
      : 0;

    if (!finalRunId) {
      try {
        this.log('info', 'Creating placeholder judge run for workflow report');

        const runTitle = `Workflow Judge Report - ${baseName}`;
        const testId = `WORKFLOW-${Date.now()}`;
        const dateTest = new Date().toISOString().split('T')[0];
        const startTimeTest = input.start_time || new Date().toTimeString().split(' ')[0];
        const endTimeTest = new Date().toTimeString().split(' ')[0];
        const durationString = input.duration || `${Math.round((Date.now() - new Date(startTime).getTime()) / 1000)}s`;
        const userId = context.user_id || null;

        const runResult = await db.query(
          `INSERT INTO test_runs (user_id, test_id, run_title, platform, tester_name, filename, ai_evaluation, date_test, start_time_test, end_time_test, duration, total_title, total_question, success, failed, avg_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            testId,
            runTitle,
            'llm_judge',
            input.tester_name || 'AI Judge (Workflow)',
            filename,
            input.provider || 'gemini',
            dateTest,
            startTimeTest,
            endTimeTest,
            durationString,
            [...new Set(test_data.map(i => i.title || 'General'))].length,
            totalEvaluated,
            runPassedCount,
            runFailedCount,
            avgScore
          ]
        );

        if (!runResult || !runResult[0].insertId) {
          throw new Error('Failed to create placeholder judge run - no ID returned');
        }

        finalRunId = runResult[0].insertId;
        this.log('info', `Created judge run with ID: ${finalRunId}`);
      } catch (e) {
        this.log('error', `Failed to create judge run: ${e.message}`);
        throw new Error(`Cannot save judge report without run_id: ${e.message}`);
      }
    } else {
      // If a run_id exists but the run record is missing or incomplete, ensure it exists in test_runs.
      const existingRun = await db.query(
        'SELECT id FROM test_runs WHERE id = ?',
        [finalRunId]
      );
      if (!existingRun[0].length) {
        this.log('info', `Run ID ${finalRunId} not found, creating judge run entry`);
        const runResult = await db.query(
          `INSERT INTO test_runs (user_id, test_id, run_title, platform, tester_name, filename, ai_evaluation, date_test, start_time_test, end_time_test, duration, total_title, total_question, success, failed, avg_score)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            context.user_id || null,
            `WORKFLOW-${Date.now()}`,
            `Workflow Judge Report - ${baseName}`,
            'llm_judge',
            input.tester_name || 'AI Judge (Workflow)',
            filename,
            input.provider || 'gemini',
            new Date().toISOString().split('T')[0],
            new Date().toTimeString().split(' ')[0],
            new Date().toTimeString().split(' ')[0],
            `${Math.round((Date.now() - new Date(startTime).getTime()) / 1000)}s`,
            [...new Set(test_data.map(i => i.title || 'General'))].length,
            totalEvaluated,
            runPassedCount,
            runFailedCount,
            avgScore
          ]
        );
        finalRunId = runResult[0].insertId;
      }
    }

    if (resultsData.length > 0) {
      const resultsValues = resultsData.map((item, index) => [
        finalRunId,
        item.no || index + 1,
        item.title || item.topic || `Item ${index + 1}`,
        item.question || 'N/A',
        item.response_kb || item.expected_answer || item.expected || 'N/A',
        item.response_llm || item.bot_response || item.actual || item.response || 'N/A',
        (item.ai_passed !== undefined ? item.ai_passed : item.status === 'pass') ? 'PASS' : 'FAILED',
        item.duration || '0s',
        item.ai_score !== undefined ? item.ai_score : (item.skor !== undefined ? item.skor : (item.score || 0)),
        item.ai_explanation || item.explanation || 'N/A',
        item.image_capture || null
      ]);

      await db.query(
        `INSERT INTO test_results (run_id, no, title, question, response_kb, response_llm, status, duration, skor, explanation, image_path)
         VALUES ?`,
        [resultsValues]
      );
    }

    const result = await db.query(
      `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, description)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        finalRunId,
        format,
        filename,
        relativePath,
        fileSize,
        `Workflow generated ${format} report`
      ]
    );

    const artifactId = result[0].insertId;

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
