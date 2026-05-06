/**
 * Action Node Executors
 */

const BaseNode = require('./base-node');
const { pool } = require('../db');
const path = require('path');
const fs = require('fs').promises;

class RunTestNode extends BaseNode {
    constructor() {
        super();
        this.type = 'run-test';
    }

    async execute(context, node) {
        const config = node.config || {};
        const { platform, test_data_file, tester_name, greeting, platform_url } = config;

        console.log(`[RunTestNode] Executing test on platform: ${platform}`);

        // Generate test ID
        const test_id = `wf-${context.execution_id.substring(0, 8)}-${Date.now()}`;
        const start_time = new Date();

        // For now, create a mock test run
        // In production, this would integrate with actual platform executors
        const [result] = await pool.query(
            `INSERT INTO test_runs 
             (user_id, test_id, platform, tester_name, filename, url, 
              date_test, start_time_test, total_question, success, failed, avg_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, 0)`,
            [
                context.user_id,
                test_id,
                platform,
                tester_name || 'Workflow Bot',
                test_data_file,
                platform_url,
                start_time.toISOString().split('T')[0],
                start_time.toTimeString().split(' ')[0]
            ]
        );

        const run_id = result.insertId;

        // Log activity
        await pool.query(
            `INSERT INTO activity_logs (user_id, title, description, type)
             VALUES (?, ?, ?, 'test')`,
            [context.user_id, 'Test Executed via Workflow', `Platform: ${platform}, Test ID: ${test_id}`, 'test']
        );

        return {
            run_id,
            test_id,
            platform,
            status: 'completed',
            total_questions: 0,
            success_count: 0,
            failed_count: 0,
            avg_score: 0,
            duration: 0,
            results: [],
            message: 'Test execution placeholder - integrate with actual platform executors'
        };
    }
}

class AIEvaluateNode extends BaseNode {
    constructor() {
        super();
        this.type = 'ai-evaluate';
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'test_result');

        if (!input) {
            throw new Error('No test result input provided');
        }

        const { ai_provider, scoring_threshold = 0.7, custom_prompt } = config;

        console.log(`[AIEvaluateNode] Evaluating with provider: ${ai_provider}`);

        // Get user's API keys
        const [users] = await pool.query(
            'SELECT gemini_api_key, groq_api_key, cerebras_api_key, openai_api_key, custom_api_key FROM users WHERE id = ?',
            [context.user_id]
        );

        if (users.length === 0) {
            throw new Error('User not found');
        }

        const user = users[0];

        // For now, return mock evaluation
        // In production, this would integrate with actual AI evaluator
        const evaluations = (input.results || []).map(result => ({
            ...result,
            ai_score: 0.85,
            ai_explanation: 'Mock AI evaluation - integrate with actual AI evaluator',
            ai_passed: 0.85 >= scoring_threshold,
            ai_provider
        }));

        const avgScore = evaluations.length > 0 
            ? evaluations.reduce((sum, e) => sum + e.ai_score, 0) / evaluations.length 
            : 0;
        const passCount = evaluations.filter(e => e.ai_passed).length;

        return {
            run_id: input.run_id,
            evaluations,
            avg_ai_score: avgScore,
            pass_count: passCount,
            fail_count: evaluations.length - passCount,
            threshold: scoring_threshold,
            provider: ai_provider
        };
    }
}

class GenerateReportNode extends BaseNode {
    constructor() {
        super();
        this.type = 'generate-report';
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'test_result');

        if (!input) {
            throw new Error('No test result input provided');
        }

        const { report_format, output_filename, include_screenshots = true } = config;

        console.log(`[GenerateReportNode] Generating ${report_format} report: ${output_filename}`);

        // Create artifacts directory if it doesn't exist
        const artifactsDir = path.join(__dirname, '..', '..', 'artifacts');
        try {
            await fs.mkdir(artifactsDir, { recursive: true });
        } catch (err) {
            // Directory might already exist
        }

        // Generate report file
        const timestamp = Date.now();
        const filename = `${output_filename}-${timestamp}.${report_format}`;
        const file_path = path.join(artifactsDir, filename);

        // Write report content
        let content = '';
        if (report_format === 'json') {
            content = JSON.stringify(input, null, 2);
        } else if (report_format === 'html') {
            content = this.generateHTMLReport(input);
        } else if (report_format === 'excel') {
            content = 'Excel report generation - integrate with actual report generator';
        }

        await fs.writeFile(file_path, content);

        // Store artifact in database
        const [result] = await pool.query(
            `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                input.run_id || 0,
                report_format,
                filename,
                file_path,
                content.length,
                `Generated by workflow: ${context.workflow_id}`
            ]
        );

        return {
            artifact_id: result.insertId,
            filename,
            file_path,
            file_size: content.length,
            download_url: `/api/artifacts/${result.insertId}/download`,
            format: report_format
        };
    }

    generateHTMLReport(data) {
        return `<!DOCTYPE html>
<html>
<head>
    <title>Workflow Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        h1 { color: #333; }
        .summary { background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0; }
        .metric { display: inline-block; margin-right: 20px; }
        .metric-label { font-weight: bold; }
    </style>
</head>
<body>
    <h1>Workflow Test Report</h1>
    <div class="summary">
        <div class="metric">
            <span class="metric-label">Platform:</span> ${data.platform || 'N/A'}
        </div>
        <div class="metric">
            <span class="metric-label">Test ID:</span> ${data.test_id || 'N/A'}
        </div>
        <div class="metric">
            <span class="metric-label">Status:</span> ${data.status || 'N/A'}
        </div>
    </div>
    <pre>${JSON.stringify(data, null, 2)}</pre>
</body>
</html>`;
    }
}

class SendNotificationNode extends BaseNode {
    constructor() {
        super();
        this.type = 'send-notification';
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'data') || {};

        const { title, message, type = 'info' } = config;

        // Replace template variables
        const finalTitle = this.replaceVariables(title, input);
        const finalMessage = this.replaceVariables(message, input);

        console.log(`[SendNotificationNode] Sending ${type} notification: ${finalTitle}`);

        // Create notification
        const [result] = await pool.query(
            `INSERT INTO notifications (title, message, type, is_read)
             VALUES (?, ?, ?, FALSE)`,
            [finalTitle, finalMessage, type]
        );

        return {
            notification_id: result.insertId,
            title: finalTitle,
            message: finalMessage,
            type,
            created_at: new Date().toISOString(),
            delivery_status: 'sent'
        };
    }
}

module.exports = {
    RunTestNode: new RunTestNode(),
    AIEvaluateNode: new AIEvaluateNode(),
    GenerateReportNode: new GenerateReportNode(),
    SendNotificationNode: new SendNotificationNode()
};
