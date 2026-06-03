const BaseNode = require('./base-node');
const { pool: db } = require('../../db');
const { normalizeItem } = require('./llm-judge-utils');

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
          key: 'format',
          label: 'Report Format',
          type: 'select',
          required: false,
          default: 'html',
          options: [
            { label: 'JSON', value: 'json' },
            { label: 'HTML', value: 'html' },
            { label: 'Excel', value: 'excel' }
          ]
        },
        {
          key: 'template',
          label: 'Template',
          type: 'text',
          required: false,
          default: 'standard-report'
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

    const format = config.format || config.report_format || 'html';
    const baseName = config.template || config.output_filename || `report-${Date.now()}`;
    const filename = `${baseName}.${format}`;
    const outputDir = path.join(__dirname, '../../../../artifacts');
    const filePath = path.join(outputDir, filename);

    fs.mkdirSync(outputDir, { recursive: true });

    this.log('info', `Generating ${format} report: ${filename}`);

    // Standardize input data for the template
    const rawResults = input.results || input.evaluations || [];
    const normalizedResults = rawResults.map((item, index) => normalizeItem(item, index));
    const runId = input.run_id || `WF-${Date.now()}`;
    const startTime = input.start_time || new Date().toISOString();
    
    // Map data to match template/template.ejs expectations
    const test_data = normalizedResults.map((item, index) => ({
      no: item.no || index + 1,
      id: item.id || `T-${index + 1}`,
      title: item.title || 'General',
      question: item.question || 'N/A',
      expected: item.expected || 'N/A',
      actual: item.actual || 'N/A',
      response_kb: item.response_kb || item.expected || 'N/A',
      response_llm: item.response_llm || item.actual || 'N/A',
      explanation: item.ai_explanation || item.explanation || 'N/A',
      status: item.ai_passed ? 'PASS' : 'FAILED',
      skor: item.ai_score !== undefined ? item.ai_score : (item.score || 0),
      duration: item.duration || '00:00:01',
      image_capture: item.image_capture || null
    }));

    const summaryPassedCount = test_data.filter(i => i.status === 'PASS').length;
    const summaryFailedCount = test_data.length - summaryPassedCount;
    const totalDuration = test_data.reduce((acc, curr) => acc + 1, 0); // Placeholder duration logic

    const summary = [{
      id_test: runId,
      success: summaryPassedCount,
      failed: summaryFailedCount,
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
    const relativePath = path.relative(outputDir, filePath);

    let finalRunId = input.run_id;
    const evaluations = input.evaluations || [];
    const resultsData = normalizedResults;
    const totalEvaluated = evaluations.length || normalizedResults.length;
    const scoringItems = evaluations.length > 0 ? evaluations : normalizedResults;
    const passedCount = scoringItems.filter(i => i.ai_passed).length;
    const failedCount = totalEvaluated - passedCount;
    const avgScore = scoringItems.length > 0
      ? Math.round((scoringItems.reduce((sum, item) => sum + (item.ai_score || 0), 0) / scoringItems.length) * 100) / 100
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

        const runResult = await db.queryOriginal(
          `INSERT INTO test_runs (user_id, test_id, run_title, platform, tester_name, filename, ai_evaluation, date_test, start_time_test, end_time_test, duration, total_title, total_question, success, failed, avg_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING id`,
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
            passedCount,
            failedCount,
            avgScore
          ]
        );

        if (!runResult.rows || !runResult.rows[0]) {
          throw new Error('Failed to create placeholder judge run - no ID returned');
        }

        finalRunId = runResult.rows[0].id;
        this.log('info', `Created judge run with ID: ${finalRunId}`);
      } catch (e) {
        this.log('error', `Failed to create judge run: ${e.message}`);
        throw new Error(`Cannot save judge report without run_id: ${e.message}`);
      }
    } else {
      // If a run_id exists but the run record is missing or incomplete, ensure it exists in test_runs.
      const existingRun = await db.queryOriginal(
        'SELECT id FROM test_runs WHERE id = $1',
        [finalRunId]
      );
      if (!existingRun.rows.length) {
        this.log('info', `Run ID ${finalRunId} not found, creating judge run entry`);
        const runResult = await db.queryOriginal(
          `INSERT INTO test_runs (user_id, test_id, run_title, platform, tester_name, filename, ai_evaluation, date_test, start_time_test, end_time_test, duration, total_title, total_question, success, failed, avg_score)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
           RETURNING id`,
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
            passedCount,
            failedCount,
            avgScore
          ]
        );
        finalRunId = runResult.rows[0].id;
      }
    }

    if (resultsData.length > 0) {
      const rows = resultsData.map((item, index) => [
        finalRunId,
        item.no || index + 1,
        item.title || item.topic || `Item ${index + 1}`,
        item.question || 'N/A',
        item.response_kb || item.expected || 'N/A',
        item.response_llm || item.actual || 'N/A',
        item.ai_passed ? 'PASS' : 'FAILED',
        item.duration || '0s',
        item.ai_score !== undefined ? item.ai_score : (item.score || 0),
        item.ai_explanation || item.explanation || 'N/A',
        item.image_capture || null
      ]);
      await db.queryOriginal(
        `INSERT INTO test_results (run_id, no, title, question, response_kb, response_llm, status, duration, skor, explanation, image_path)
         VALUES ${rows.map((_, idx) => `($${idx * 11 + 1}, $${idx * 11 + 2}, $${idx * 11 + 3}, $${idx * 11 + 4}, $${idx * 11 + 5}, $${idx * 11 + 6}, $${idx * 11 + 7}, $${idx * 11 + 8}, $${idx * 11 + 9}, $${idx * 11 + 10}, $${idx * 11 + 11})`).join(', ')}`,
        rows.flat()
      );
    }

    const result = await db.queryOriginal(
      `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        finalRunId,
        format,
        filename,
        relativePath,
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
