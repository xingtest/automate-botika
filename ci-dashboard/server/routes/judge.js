const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');
const XLSX = require('xlsx');
const ejs = require('ejs');
const path = require('path');
// Node 18+ has built-in fetch, no need for node-fetch

// Helper to evaluate with Gemini
async function evaluateWithGemini(apiKey, payload, modelName = 'gemini-1.5-flash') {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent`;
    try {
        const response = await fetch(`${url}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: payload }] }],
                generationConfig: { temperature: 0.1, topK: 1, topP: 1 }
            }),
            signal: AbortSignal.timeout(30000) // 30 second timeout
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.error?.message || 'Gemini API Error');
        }

        const data = await response.json();

        if (!data.candidates || data.candidates.length === 0) {
            console.error('Gemini API Blocked/Empty Response:', data);
            throw new Error('Blocked or empty response from Gemini');
        }

        const text = data.candidates[0].content?.parts?.[0]?.text;
        if (!text) {
            throw new Error('Empty text in Gemini response');
        }

        // Match JSON in the response
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                return JSON.parse(jsonMatch[0]);
            } catch (e) {
                console.error('JSON Parse Error from Gemini text:', text);
                throw new Error('Invalid JSON format in Gemini response');
            }
        }
        throw new Error('No JSON found in Gemini response');
    } catch (error) {
        console.error('Gemini Eval Error:', error.message);
        return { score: 0, explanation: `Error: ${error.message}` };
    }
}

// POST /api/judge/init
router.post('/init', authenticateToken, async (req, res) => {
    try {
        const { title, tester_name, total_question } = req.body;
        console.log(`[JUDGE] Init: ${title} (${total_question} rows)`);
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
                'gemini',
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
        const { runId, row, gemini_api_key, gemini_model, custom_prompt } = req.body;
        const startTime = Date.now();
        console.log(`[JUDGE] Step: RunId ${runId}, Row No ${row.no || '?'}`);
        const apiKey = gemini_api_key || process.env.API_KEY_GEMINI;

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

LANGKAH 1: ANALISA KEBENARAN FAKTUAL (Bobot Tertinggi)
- Bandingkan fakta di "Jawaban Chatbot" dengan "Referensi Kebenaran".
- Apakah ada angka, nama, atau prosedur yang salah?
- Jika Referensi Kebenaran bilang "A", tapi Chatbot bilang "B", ini FATAL.
- PENTING: Sebutkan secara spesifik fakta mana yang benar/salah!

LANGKAH 2: ANALISA RELEVANSI & KONTEKS
- Apakah Chatbot menjawab pertanyaan user secara langsung?
- Apakah ada informasi berlebih (hallucination) yang tidak diminta dan berpotensi salah?
- PENTING: Sebutkan apakah jawaban sudah menjawab inti pertanyaan!

ATURAN SCORING:
- 1.00 (Sempurna): Faktual 100% benar, lengkap, relevan, bahasa bagus.
- 0.70 - 0.99 (Pass): Faktual benar, mungkin ada kekurangan minor di gaya bahasa atau kelengkapan detail non-krusial.
- 0.40 - 0.69 (Fail - Minor): Ada info yang kurang tepat tapi tidak fatal, atau bahasa sangat kaku/berulang.
- 0.00 - 0.39 (Fail - Major): Halusinasi (mengarang fakta), salah total, atau tidak nyambung.

FORMAT EXPLANATION YANG DIHARAPKAN:
Gunakan format bullet point dengan detail JELAS per langkah:

• Langkah 1 (Faktual): [Sebutkan fakta apa yang benar/salah/kurang]
• Langkah 2 (Relevansi): [Apakah menjawab pertanyaan atau tidak]
• Simpulan: [Kesimpulan final]

OUTPUT FINAL:
Berikan output HANYA dalam format JSON valid tanpa markdown block:
{
  "score": [angka desimal 0.00 - 1.00],
  "explanation": "[Status: ✓/⚠/✗] + Detail analisa menggunakan format bullet point di atas. Maksimal 50 kata."
}`;
        }

        const evalResult = await evaluateWithGemini(apiKey, prompt, gemini_model || 'gemini-1.5-flash');
        const score = parseFloat(evalResult.score) || 0;
        const status = score >= 0.7 ? 'pass' : 'failed';
        const durationSeconds = ((Date.now() - startTime) / 1000).toFixed(2);

        await pool.query(
            `INSERT INTO test_results (run_id, no, title, question, response_kb, response_llm, status, duration, skor, explanation, image_path)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [runId, row.no, row.title || 'LLM Evaluation', row.question, row.expected, row.actual, status, `${durationSeconds}s`, score, evalResult.explanation, null]
        );

        res.json({ success: true, result: { ...evalResult, status, score } });
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
        const { gemini_api_key, gemini_model } = req.body;
        const apiKey = gemini_api_key || process.env.API_KEY_GEMINI;
        const model = gemini_model || 'gemini-1.5-flash';

        if (!apiKey) return res.status(400).json({ error: 'API Key missing' });

        const testPrompt = 'Return this exact JSON: {"score": 1.0, "explanation": "Connection test successful"}';
        const result = await evaluateWithGemini(apiKey, testPrompt, model);

        if (result.explanation?.includes('Error:')) {
            return res.status(400).json({ success: false, error: result.explanation.replace('Error: ', '') });
        }

        res.json({ success: true, message: 'Connection successful' });
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
