const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const XLSX = require('xlsx');
const ejs = require('ejs');
const path = require('path');
const { EnhancedEvaluator, EVAL_CONFIG } = require('../services/enhanced-evaluator');
// Node 18+ has built-in fetch, no need for node-fetch

// Generic LLM Evaluator
async function evaluateWithLLM(settings, payload) {
    const provider = settings.provider || 'gemini';
    const model = settings[`${provider}_model`] || (provider === 'gemini' ? 'gemini-1.5-flash' : '');
    const apiKey = settings[`${provider}_api_key`];
    const baseUrl = settings.custom_api_url;

    try {
        if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: payload }] }],
                    generationConfig: { temperature: 0.1 }
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Gemini API Error');
            }

            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) throw new Error('Empty response from Gemini');
            return parseJsonFromResponse(text);
        } else {
            // OpenAI-compatible providers (Groq, Cerebras, OpenAI, Custom)
            let url = '';
            if (provider === 'groq') url = 'https://api.groq.com/openai/v1/chat/completions';
            else if (provider === 'cerebras') url = 'https://api.cerebras.ai/v1/chat/completions';
            else if (provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
            else if (provider === 'custom') url = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl.replace(/\/$/, '')}/chat/completions`;

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: model || (provider === 'groq' ? 'llama-3.1-70b-versatile' : provider === 'cerebras' ? 'llama3.1-70b' : 'gpt-4o'),
                    messages: [{ role: 'user', content: payload }],
                    temperature: 0.1
                }),
                signal: AbortSignal.timeout(30000)
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || `${provider} API Error`);
            }

            const data = await response.json();
            const text = data.choices?.[0]?.message?.content;
            if (!text) throw new Error(`Empty response from ${provider}`);
            return parseJsonFromResponse(text);
        }
    } catch (error) {
        console.error(`[EVAL ERROR] ${provider}:`, error.message);
        return { score: 0, explanation: `Error: ${error.message}` };
    }
}

function parseJsonFromResponse(text) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (e) {
            console.error('JSON Parse Error:', text);
            throw new Error('Invalid JSON format in LLM response');
        }
    }
    throw new Error('No JSON found in LLM response');
}

// POST /api/judge/init
router.post('/init', authenticateToken, async (req, res) => {
    try {
        const { title, tester_name, total_question, provider } = req.body;
        console.log(`[JUDGE] Init: ${title} (${total_question} rows) via ${provider || 'gemini'}`);
        const [result] = await pool.query(
            `INSERT INTO test_runs (user_id, test_id, run_title, platform, tester_name, filename, ai_evaluation, date_test, start_time_test, duration, total_title, total_question, success, failed, avg_score)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
            [
                req.user.id,
                `JUDGE-${Date.now()}`,
                title || 'LLM Judge Evaluation',
                'llm_judge',
                tester_name || req.user.username,
                'uploaded_file',
                provider || 'gemini',
                new Date().toISOString().split('T')[0],
                new Date().toTimeString().split(' ')[0],
                'N/A',
                1,
                total_question || 0
            ]
        );
        res.json({ success: true, runId: result.insertId });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/judge/step
router.post('/step', authenticateToken, async (req, res) => {
    try {
        const { runId, row, custom_prompt, presets, ...settings } = req.body;
        const startTime = Date.now();
        const activePresets = Array.isArray(presets) ? presets : [];
        console.log(`[JUDGE] Step: RunId ${runId}, Row ${row.no || '?'} [${settings.provider || 'gemini'}] Presets: ${activePresets.length ? activePresets.join(', ') : 'none'}`);

        const evaluator = new EnhancedEvaluator();
        const localEval = evaluator.evaluate(row.question || '', row.expected || '', row.actual || '', row.title || 'Evaluation');
        console.log(`[JUDGE] Local evaluation: Score=${localEval.totalScore}, Success=${localEval.success}, Hallucinations=${localEval.hasHallucination ? 'YES' : 'NO'}`);

        let prompt;
        if (custom_prompt && custom_prompt.trim()) {
            prompt = custom_prompt
                .replace(/\{title\}/g, row.title || 'N/A')
                .replace(/\{question\}/g, row.question || '')
                .replace(/\{expected\}/g, row.expected || '')
                .replace(/\{actual\}/g, row.actual || '');
        } else {
            prompt = `Anda adalah QA Engineer Senior dan Linguist Specialist. Tugas Anda adalah mengevaluasi kualitas jawaban Chatbot dengan metodologi "Chain of Thought".

KONTEKS PENGUJIAN:
- Topik: ${row.title || 'N/A'}
- Pertanyaan User: "${row.question}"
- Referensi Kebenaran (Knowledge Base): "${row.expected}"
- Jawaban Chatbot (Yang dievaluasi): "${row.actual}"

INSTRUKSI EVALUASI:
Lakukan analisa langkah demi langkah sebelum memberikan skor akhir. WAJIB JELASKAN SEMUA LANGKAH:

LANGKAH 1: ANALISA KEBENARAN FAKTUAL (Bobot 40%)
- Bandingkan fakta di "Jawaban Chatbot" dengan "Referensi Kebenaran".
- Apakah ada angka, nama, atau prosedur yang salah?
- Jika Referensi Kebenaran bilang "A", tapi Chatbot bilang "B", ini FATAL.
- PENTING: Sebutkan secara spesifik fakta mana yang benar/salah!

LANGKAH 2: ANALISA RELEVANSI (Bobot 25%)
- Apakah Chatbot menjawab pertanyaan user secara langsung?
- Apakah jawaban fokus pada inti pertanyaan?

LANGKAH 3: ANALISA KELENGKAPAN (Bobot 20%)
- Apakah semua poin penting dalam referensi disebutkan?
- Apakah jawaban cukup komprehensif?

LANGKAH 4: DETEKSI HALUSINASI (Bobot 15%)
- Apakah ada informasi berlebih yang tidak ada di referensi dan berpotensi salah?
- Apakah ada klaim yang tidak didukung oleh referensi?

ATURAN SCORING:
- 1.00 (Sempurna): Faktual 100% benar, lengkap, relevan, bahasa bagus, tanpa halusinasi.
- 0.70 - 0.99 (Pass): Faktual benar, mungkin ada kekurangan minor.
- 0.40 - 0.69 (Fail - Minor): Ada info kurang tepat tapi tidak fatal.
- 0.00 - 0.39 (Fail - Major): Halusinasi, salah total, atau tidak nyambung.

OUTPUT FINAL:
Berikan output HANYA dalam format JSON valid tanpa markdown block:
{
  "score": [angka desimal 0.00 - 1.00],
  "explanation": "[Status: ✓/⚠/✗] + Detail analisa. Maksimal 50 kata."
}`;
        }

        const evalResult = await evaluateWithLLM(settings, prompt);
        
        const llmScore = parseFloat(evalResult.score) || 0;
        const combinedScore = (llmScore * 0.6) + (localEval.totalScore * 0.4);
        const finalScore = parseFloat(combinedScore.toFixed(3));
        
        const status = finalScore >= 0.7 ? 'pass' : 'failed';
        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        const combinedExplanation = `${localEval.explanation} | LLM: ${evalResult.explanation || ''}`.substring(0, 500);

        await pool.query(
            `INSERT INTO test_results (run_id, no, title, question, response_kb, response_llm, status, duration, skor, explanation, image_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [runId, row.no, row.title || 'LLM Evaluation', row.question, row.expected, row.actual, status, `${durationSeconds}s`, finalScore, combinedExplanation, null]
        );

        res.json({ 
            success: true, 
            result: { 
                ...evalResult, 
                status, 
                score: finalScore,
                llm_score: llmScore,
                local_score: localEval.totalScore,
                has_hallucination: localEval.hasHallucination,
                hallucinations: localEval.hallucinations,
                breakdown: localEval.breakdown
            } 
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/judge/finalize
router.post('/finalize', authenticateToken, async (req, res) => {
    try {
        const { runId } = req.body;
        console.log(`[JUDGE] Finalize: RunId ${runId}`);
        const [results] = await pool.query('SELECT status, skor FROM test_results WHERE run_id = ?', [runId]);

        if (results.length === 0) return res.json({ success: true });

        const totalPass = results.filter(r => r.status === 'pass').length;
        const totalFail = results.length - totalPass;
        const avgScore = results.reduce((acc, curr) => acc + parseFloat(curr.skor), 0) / results.length;

        // Calculate total duration
        const totalDurationSeconds = results.reduce((acc, curr) => {
            const d = parseFloat(curr.duration) || 0;
            return acc + d;
        }, 0);
        const hours = Math.floor(totalDurationSeconds / 3600).toString().padStart(2, '0');
        const minutes = Math.floor((totalDurationSeconds % 3600) / 60).toString().padStart(2, '0');
        const seconds = Math.floor(totalDurationSeconds % 60).toString().padStart(2, '0');
        const durationStr = `${hours}:${minutes}:${seconds}`;

        await pool.query(
            'UPDATE test_runs SET success = ?, failed = ?, avg_score = ?, duration = ?, end_time_test = ? WHERE id = ?',
            [totalPass, totalFail, avgScore, durationStr, new Date().toTimeString().split(' ')[0], runId]
        );

        res.json({ success: true, stats: { totalPass, totalFail, avgScore } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/judge/test-connection
router.post('/test-connection', authenticateToken, async (req, res) => {
    try {
        const settings = req.body;
        const provider = settings.provider || 'gemini';
        const apiKey = settings[`${provider}_api_key`];

        if (!apiKey) return res.status(400).json({ error: 'API Key missing' });

        const testPrompt = 'Return this exact JSON: {"score": 1.0, "explanation": "Connection test successful"}';
        const result = await evaluateWithLLM(settings, testPrompt);

        if (result.explanation?.includes('Error:')) {
            return res.status(400).json({ success: false, error: result.explanation.replace('Error: ', '') });
        }

        res.json({ success: true, message: 'Connection successful', model: settings[`${provider}_model`] || 'default' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/judge/report/:runId
router.get('/report/:runId', authenticateToken, async (req, res) => {
    try {
        const { runId } = req.params;

        // 1. Fetch Summary
        const [runRows] = await pool.query(`
            SELECT *, test_id AS id_test 
            FROM test_runs 
            WHERE id = ? AND user_id = ?
        `, [runId, req.user.id]);
        if (runRows.length === 0) return res.status(404).send('Report not found');
        const summary = runRows; // Template expects array

        // 2. Fetch Results
        const [resultRows] = await pool.query(`
            SELECT *, image_path AS image_capture 
            FROM test_results 
            WHERE run_id = ? 
            ORDER BY no ASC
        `, [runId]);

        // 3. Render Template
        const templatePath = path.join(__dirname, '..', '..', '..', 'template', 'judge-template.ejs');
        ejs.renderFile(templatePath, { summary, test_data: resultRows }, (err, html) => {
            if (err) {
                console.error('EJS Error:', err);
                return res.status(500).send('Error rendering template');
            }
            res.setHeader('Content-Type', 'text/html');
            res.setHeader('Content-Disposition', `attachment; filename=judge-report-${runId}.html`);
            res.send(html);
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// GET /api/judge/view/:runId - View report inline (in browser tab)
router.get('/view/:runId', authenticateToken, async (req, res) => {
    try {
        const { runId } = req.params;
        const [runRows] = await pool.query(`
            SELECT *, test_id AS id_test FROM test_runs WHERE id = ? AND user_id = ?
        `, [runId, req.user.id]);
        if (runRows.length === 0) return res.status(404).send('Report not found');
        const summary = runRows;

        const [resultRows] = await pool.query(`
            SELECT *, image_path AS image_capture FROM test_results WHERE run_id = ? ORDER BY no ASC
        `, [runId]);

        const templatePath = path.join(__dirname, '..', '..', '..', 'template', 'judge-template.ejs');
        ejs.renderFile(templatePath, { summary, test_data: resultRows }, (err, html) => {
            if (err) {
                console.error('EJS Error:', err);
                return res.status(500).send('Error rendering template');
            }
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// DELETE /api/judge/run/:runId - Delete a judge run and its results
router.delete('/run/:runId', authenticateToken, async (req, res) => {
    try {
        const { runId } = req.params;
        // Verify ownership
        const [rows] = await pool.query('SELECT id FROM test_runs WHERE id = ? AND user_id = ?', [runId, req.user.id]);
        if (rows.length === 0) return res.status(404).json({ error: 'Run not found or access denied' });

        await pool.query('DELETE FROM test_results WHERE run_id = ?', [runId]);
        await pool.query('DELETE FROM test_runs WHERE id = ?', [runId]);
        res.json({ success: true, message: 'Judge run deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/judge/clear-all - Delete all judge runs for the current user
router.delete('/clear-all', authenticateToken, async (req, res) => {
    try {
        const [runs] = await pool.query("SELECT id FROM test_runs WHERE user_id = ? AND platform = 'llm_judge'", [req.user.id]);
        const ids = runs.map(r => r.id);
        if (ids.length > 0) {
            await pool.query('DELETE FROM test_results WHERE run_id IN (?)', [ids]);
            await pool.query('DELETE FROM test_runs WHERE id IN (?)', [ids]);
        }
        res.json({ success: true, message: `Deleted ${ids.length} judge run(s)` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
