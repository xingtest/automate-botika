/**
 * Action Node Executors
 */

const BaseNode = require('./base-node');
const { pool } = require('../db');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

// Platform mapping from config name to executor name
const platformMap = {
    'webchat': 'webchat-v3',
    'telegram': 'telegram',
    'facebook': 'facebook',
    'instagram': 'instagram',
    'dhai': 'dhai'
};

class RunTestNode extends BaseNode {
    constructor() {
        super();
        this.type = 'run-test';
    }

    async execute(context, node) {
        const config = node.config || {};
        const { platform, test_data_file, tester_name, greeting, platform_url } = config;

        // Validation
        if (!platform) {
            throw new Error('Configuration error: platform is required');
        }
        if (!test_data_file) {
            throw new Error('Configuration error: test_data_file is required');
        }
        if (!platform_url) {
            throw new Error('Configuration error: platform_url is required');
        }

        // Verify test data file exists
        const testDataPath = path.resolve(test_data_file);
        if (!fs.existsSync(testDataPath)) {
            throw new Error(`Test data file not found: ${testDataPath}`);
        }

        console.log(`[RunTestNode] Executing test on platform: ${platform}`);

        // Generate test ID
        const test_id = `wf-${context.execution_id.substring(0, 8)}-${Date.now()}`;
        const start_time = new Date();

        // Map platform to executor
        const executor = platformMap[platform.toLowerCase()];
        if (!executor) {
            throw new Error(`Unsupported platform: ${platform}`);
        }

        // Build executor path
        const executorPath = path.join(__dirname, '..', '..', '..', 'dist', 'platforms', `${executor}.js`);
        if (!fs.existsSync(executorPath)) {
            throw new Error(`Platform executor not found: ${executorPath}`);
        }

        // Prepare environment for child process
        const env = {
            ...process.env,
            PLATFORM: platform.toLowerCase(),
            FILENAME: test_data_file,
            TESTER_NAME: tester_name || 'Workflow Bot',
            GREETING: greeting || 'Halo',
            HEADLESS: 'true'
        };

        // Set platform-specific URL env vars
        if (platform.toLowerCase() === 'webchat') {
            env.TARGET_URL = platform_url;
        } else if (platform.toLowerCase() === 'webchat-v3') {
            env.WEBCHAT_V3_TARGET_URL = platform_url;
        } else if (platform.toLowerCase() === 'dhai') {
            env.DHAI_TARGET_URL = platform_url;
        }

        // Run platform executor via child process
        let testResult;
        try {
            const output = execSync(`node "${executorPath}"`, {
                env,
                encoding: 'utf-8',
                timeout: 300000, // 5 minutes timeout
                cwd: path.join(__dirname, '..', '..', '..')
            });

            // Try to parse JSON output from last line
            const lines = output.trim().split('\n');
            const lastLine = lines[lines.length - 1];
            try {
                testResult = JSON.parse(lastLine);
            } catch (e) {
                // If last line is not JSON, create result from output
                testResult = {
                    success: true,
                    output: output,
                    platform,
                    test_data_file
                };
            }
        } catch (error) {
            console.error(`[RunTestNode] Platform executor failed:`, error);
            throw new Error(`Test execution failed: ${error.message}`);
        }

        // Calculate results
        const results = testResult.results || [];
        const total_questions = results.length;
        const success_count = results.filter(r => r.status === 'success' || r.skor >= 70).length;
        const failed_count = total_questions - success_count;
        const avg_score = total_questions > 0
            ? results.reduce((sum, r) => sum + (r.skor || 0), 0) / total_questions
            : 0;

        // Save test run to database
        const [result] = await pool.query(
            `INSERT INTO test_runs 
             (user_id, test_id, platform, tester_name, filename, url, 
              date_test, start_time_test, total_question, success, failed, avg_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                context.user_id,
                test_id,
                platform,
                tester_name || 'Workflow Bot',
                test_data_file,
                platform_url,
                start_time.toISOString().split('T')[0],
                start_time.toTimeString().split(' ')[0],
                total_questions,
                success_count,
                failed_count,
                avg_score
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
            total_questions,
            success_count,
            failed_count,
            avg_score,
            duration: testResult.duration || 0,
            results,
            message: `Test executed successfully on ${platform}`
        };
    }
}

// API key environment variable mapping
const providerApiKeyMap = {
    'gemini': 'GEMINI_API_KEY',
    'groq': 'GROQ_API_KEY',
    'openai': 'OPENAI_API_KEY',
    'cerebras': 'CEREBRAS_API_KEY'
};

// API endpoints for each provider
const providerEndpoints = {
    'gemini': 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent',
    'groq': 'https://api.groq.com/openai/v1/chat/completions',
    'openai': 'https://api.openai.com/v1/chat/completions',
    'cerebras': 'https://api.cerebras.ai/v1/chat/completions'
};

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

        // Validate API key
        this.validateApiKey(ai_provider);

        // Get results to evaluate
        const results = input.results || [];
        if (results.length === 0) {
            return {
                run_id: input.run_id,
                evaluations: [],
                avg_ai_score: 0,
                pass_count: 0,
                fail_count: 0,
                threshold: scoring_threshold,
                provider: ai_provider
            };
        }

        // Evaluate each result with AI
        const evaluations = await Promise.all(
            results.map(async (item) => {
                try {
                    const aiResult = await this.callAIProvider(ai_provider, item, scoring_threshold, custom_prompt);
                    return {
                        ...item,
                        ai_score: aiResult.score,
                        ai_explanation: aiResult.explanation,
                        ai_passed: aiResult.score >= scoring_threshold,
                        ai_provider
                    };
                } catch (error) {
                    console.error(`[AIEvaluateNode] AI evaluation failed for item:`, error);
                    return {
                        ...item,
                        ai_score: 0,
                        ai_explanation: `AI evaluation failed: ${error.message}`,
                        ai_passed: false,
                        ai_provider
                    };
                }
            })
        );

        const avgScore = evaluations.length > 0 
            ? evaluations.reduce((sum, e) => sum + e.ai_score, 0) / evaluations.length 
            : 0;
        const passCount = evaluations.filter(e => e.ai_passed).length;

        return {
            run_id: input.run_id,
            evaluations,
            avg_ai_score: parseFloat(avgScore.toFixed(3)),
            pass_count: passCount,
            fail_count: evaluations.length - passCount,
            threshold: scoring_threshold,
            provider: ai_provider
        };
    }

    validateApiKey(provider) {
        const envVar = providerApiKeyMap[provider];
        if (!envVar) {
            throw new Error(`Unknown AI provider: ${provider}`);
        }
        if (!process.env[envVar]) {
            throw new Error(`API key for ${provider} is not configured`);
        }
    }

    async callAIProvider(provider, item, threshold, customPrompt) {
        const apiKey = process.env[providerApiKeyMap[provider]];
        const prompt = this.createEvaluationPrompt(item, customPrompt);

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${provider} API timeout`)), 30000);
        });

        // Call provider API with timeout
        const apiPromise = this.callProviderAPI(provider, apiKey, prompt);
        const response = await Promise.race([apiPromise, timeoutPromise]);

        return response;
    }

    async callProviderAPI(provider, apiKey, prompt) {
        const endpoint = providerEndpoints[provider];

        let requestBody;
        let headers = {
            'Content-Type': 'application/json'
        };

        if (provider === 'gemini') {
            // Gemini uses query parameter for API key
            requestBody = {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            };
        } else {
            // OpenAI-compatible APIs (Groq, OpenAI, Cerebras)
            headers['Authorization'] = `Bearer ${apiKey}`;
            requestBody = {
                model: this.getModelForProvider(provider),
                messages: [
                    { role: 'system', content: 'You are a QA evaluation expert. Evaluate responses and return JSON with score and explanation.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
            };
        }

        const url = provider === 'gemini' ? `${endpoint}?key=${apiKey}` : endpoint;

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`${provider} API Error ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        return this.parseProviderResponse(provider, data);
    }

    getModelForProvider(provider) {
        const models = {
            'gemini': 'gemini-1.5-flash-latest',
            'groq': 'llama-3.3-70b-versatile',
            'openai': 'gpt-4o-mini',
            'cerebras': 'llama-3.3-70b'
        };
        return models[provider] || 'gpt-4o-mini';
    }

    parseProviderResponse(provider, data) {
        let text;
        if (provider === 'gemini') {
            text = data.candidates[0].content.parts[0].text;
        } else {
            text = data.choices[0].message.content;
        }

        // Clean and parse JSON
        let cleanText = text.trim();
        const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleanText = jsonMatch[0];
        }

        const result = JSON.parse(cleanText);
        return {
            score: parseFloat(parseFloat(result.score).toFixed(3)),
            explanation: result.explanation || 'No explanation provided'
        };
    }

    createEvaluationPrompt(item, customPrompt) {
        const basePrompt = `Evaluate the following chatbot response:

Question: "${item.question || ''}"
Expected Answer: "${item.response_kb || ''}"
Actual Answer: "${item.response_llm || item.response || ''}"

Provide your evaluation in JSON format:
{
  "score": [number between 0.00 and 1.00],
  "explanation": "[brief explanation of the score]"
}

Scoring criteria:
- 1.00: Perfect match, complete and accurate
- 0.70-0.99: Good, mostly correct with minor issues
- 0.40-0.69: Partially correct, significant issues
- 0.00-0.39: Incorrect or irrelevant`;

        return customPrompt ? `${customPrompt}\n\n${basePrompt}` : basePrompt;
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

        // Validate required input data
        if (!input.run_id && (!input.results || input.results.length === 0)) {
            throw new Error('Invalid input: test results are required to generate a report');
        }

        const { report_format, output_filename, include_screenshots = true } = config;

        console.log(`[GenerateReportNode] Generating ${report_format} report: ${output_filename}`);

        // Create artifacts directory if it doesn't exist
        const artifactsDir = path.join(__dirname, '..', '..', 'artifacts');
        try {
            await fs.promises.mkdir(artifactsDir, { recursive: true });
        } catch (err) {
            // Directory might already exist
        }

        // Generate report file
        const timestamp = Date.now();
        const filename = `${output_filename}-${timestamp}.${report_format}`;
        const file_path = path.join(artifactsDir, filename);

        // Write report content based on format
        let content = '';
        let file_size = 0;

        if (report_format === 'json') {
            content = JSON.stringify(input, null, 2);
            await fs.promises.writeFile(file_path, content);
            file_size = content.length;
        } else if (report_format === 'html') {
            // Use ejs for HTML template rendering
            try {
                const ejs = require('ejs');
                const templatePath = path.join(__dirname, '..', '..', 'template', 'template.ejs');
                
                let htmlContent;
                if (fs.existsSync(templatePath)) {
                    const template = await fs.promises.readFile(templatePath, 'utf-8');
                    htmlContent = ejs.render(template, { data: input, include_screenshots });
                } else {
                    // Fallback to basic HTML
                    htmlContent = this.generateHTMLReport(input);
                }
                
                await fs.promises.writeFile(file_path, htmlContent);
                file_size = htmlContent.length;
                content = htmlContent;
            } catch (error) {
                console.error('[GenerateReportNode] HTML generation failed:', error);
                throw new Error(`HTML report generation failed: ${error.message}`);
            }
        } else if (report_format === 'excel') {
            // Try to use the compiled excel report generator
            try {
                const excelGeneratorPath = path.join(__dirname, '..', '..', '..', 'dist', 'utils', 'excel-report-generator.js');
                if (fs.existsSync(excelGeneratorPath)) {
                    const { generateExcelReport } = require(excelGeneratorPath);
                    await generateExcelReport(input, file_path);
                    const stats = fs.statSync(file_path);
                    file_size = stats.size;
                } else {
                    // Fallback: create a simple JSON file as placeholder
                    const excelPlaceholder = JSON.stringify(input, null, 2);
                    await fs.promises.writeFile(file_path, excelPlaceholder);
                    file_size = excelPlaceholder.length;
                    content = excelPlaceholder;
                }
            } catch (error) {
                console.error('[GenerateReportNode] Excel generation failed:', error);
                throw new Error(`Excel report generation failed: ${error.message}`);
            }
        } else {
            throw new Error(`Unsupported report format: ${report_format}`);
        }

        // Store artifact in database
        const [result] = await pool.query(
            `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, description)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                input.run_id || 0,
                report_format,
                filename,
                file_path,
                file_size,
                `Generated by workflow: ${context.workflow_id}`
            ]
        );

        return {
            artifact_id: result.insertId,
            filename,
            file_path,
            file_size,
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
        this.config_schema = {
            fields: [
                {
                    name: 'channel',
                    type: 'options',
                    options: [
                        { name: 'Dashboard', value: 'dashboard' },
                        { name: 'Telegram', value: 'telegram' },
                        { name: 'Email', value: 'email' }
                    ],
                    default: 'dashboard',
                    description: 'Channel pengiriman notifikasi'
                },
                {
                    name: 'recipient',
                    type: 'string',
                    description: 'Alamat email, Chat ID Telegram, atau username dashboard'
                },
                {
                    name: 'message',
                    type: 'textarea',
                    description: 'Isi pesan. Gunakan {{variable}} untuk menyisipkan data dinamis'
                }
            ]
        };
    }

    async execute(context, node) {
        const config = node.config || {};
        const input = this.getInput(context, node.id, 'data') || {};

        const { channel = 'dashboard', recipient, message, title, type = 'info' } = config;

        // Replace template variables
        const finalMessage = this.replaceVariables(message, input);
        const finalTitle = this.replaceVariables(title, input);

        console.log(`[SendNotificationNode] Sending via ${channel}: ${finalTitle || 'Notification'}`);

        // Route based on channel
        switch (channel) {
            case 'dashboard':
                return this.sendDashboardNotification(finalTitle, finalMessage, type);
            case 'telegram':
                return this.sendTelegramNotification(recipient, finalMessage);
            case 'email':
                return this.sendEmailNotification(recipient, finalTitle, finalMessage);
            default:
                throw new Error(`Unknown notification channel: ${channel}`);
        }
    }

    async sendDashboardNotification(title, message, type) {
        try {
            const [result] = await pool.query(
                `INSERT INTO notifications (title, message, type, is_read)
                 VALUES (?, ?, ?, FALSE)`,
                [title, message, type]
            );

            return {
                notification_id: result.insertId,
                title,
                message,
                type,
                channel: 'dashboard',
                created_at: new Date().toISOString(),
                delivery_status: 'sent'
            };
        } catch (error) {
            console.error('[SendNotificationNode] Dashboard notification failed:', error);
            return {
                success: false,
                error_message: `Dashboard notification failed: ${error.message}`,
                channel: 'dashboard'
            };
        }
    }

    async sendTelegramNotification(chatId, message) {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('[SendNotificationNode] TELEGRAM_BOT_TOKEN not configured');
            return {
                success: false,
                error_message: 'TELEGRAM_BOT_TOKEN not configured',
                channel: 'telegram'
            };
        }

        if (!chatId) {
            return {
                success: false,
                error_message: 'Chat ID is required for Telegram notifications',
                channel: 'telegram'
            };
        }

        try {
            const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            const data = await response.json();
            if (!data.ok) {
                throw new Error(data.description || 'Telegram API error');
            }

            return {
                success: true,
                message_id: data.result.message_id,
                chat_id: chatId,
                channel: 'telegram',
                delivery_status: 'sent'
            };
        } catch (error) {
            console.error('[SendNotificationNode] Telegram notification failed:', error);
            return {
                success: false,
                error_message: `Telegram notification failed: ${error.message}`,
                channel: 'telegram'
            };
        }
    }

    async sendEmailNotification(to, subject, message) {
        const smtpHost = process.env.SMTP_HOST;
        const smtpPort = process.env.SMTP_PORT;
        const smtpUser = process.env.SMTP_USER;
        const smtpPass = process.env.SMTP_PASS;

        if (!smtpHost || !smtpPort || !smtpUser || !smtpPass) {
            console.error('[SendNotificationNode] SMTP configuration incomplete');
            return {
                success: false,
                error_message: 'SMTP configuration incomplete (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS required)',
                channel: 'email'
            };
        }

        if (!to) {
            return {
                success: false,
                error_message: 'Email recipient is required',
                channel: 'email'
            };
        }

        try {
            const nodemailer = require('nodemailer');
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(smtpPort),
                secure: parseInt(smtpPort) === 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            const info = await transporter.sendMail({
                from: smtpUser,
                to,
                subject: subject || 'Workflow Notification',
                html: `<pre>${message}</pre>`
            });

            return {
                success: true,
                message_id: info.messageId,
                recipient: to,
                channel: 'email',
                delivery_status: 'sent'
            };
        } catch (error) {
            console.error('[SendNotificationNode] Email notification failed:', error);
            return {
                success: false,
                error_message: `Email notification failed: ${error.message}`,
                channel: 'email'
            };
        }
    }
}

module.exports = {
    RunTestNode: new RunTestNode(),
    AIEvaluateNode: new AIEvaluateNode(),
    GenerateReportNode: new GenerateReportNode(),
    SendNotificationNode: new SendNotificationNode()
};
