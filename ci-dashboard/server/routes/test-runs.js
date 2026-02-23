const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken, authenticateRunner } = require('../middleware/auth');

// GET /api/test-runs - List all test runs
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { platform, tester, limit = 50, offset = 0 } = req.query;
        let sql = 'SELECT * FROM test_runs WHERE user_id = ?';
        const params = [req.user.id];

        if (platform) { sql += ' AND platform = ?'; params.push(platform); }
        if (tester) { sql += ' AND tester_name LIKE ?'; params.push(`%${tester}%`); }

        sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(sql, params);

        // Get total count
        let countSql = 'SELECT COUNT(*) as total FROM test_runs WHERE user_id = ?';
        const countParams = [req.user.id];
        if (platform) { countSql += ' AND platform = ?'; countParams.push(platform); }
        if (tester) { countSql += ' AND tester_name LIKE ?'; countParams.push(`%${tester}%`); }
        const [countRows] = await pool.query(countSql, countParams);

        res.json({ data: rows, total: countRows[0].total, limit: parseInt(limit), offset: parseInt(offset) });
    } catch (err) {
        console.error('Error fetching test runs:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/test-runs/:id - Get single test run with results
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const [runs] = await pool.query('SELECT * FROM test_runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        if (!runs.length) return res.status(404).json({ error: 'Test run not found or access denied' });

        const [results] = await pool.query('SELECT * FROM test_results WHERE run_id = ? ORDER BY id', [req.params.id]);
        res.json({ run: runs[0], results });
    } catch (err) {
        console.error('Error fetching test run:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/test-runs - Create new test run (with optional results)
router.post('/', authenticateRunner, async (req, res) => {
    try {
        const { summary, results } = req.body;
        const userId = req.user?.id || summary.user_id || null;

        // Insert test run summary
        const [runResult] = await pool.query(
            `INSERT INTO test_runs (user_id, test_id, platform, tester_name, filename, ai_evaluation, url, page_name, browser_name, date_test, start_time_test, end_time_test, duration, total_title, total_question, success, failed, avg_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, summary.id_test, summary.platform || '', summary.tester_name, summary.filename || '',
                summary.ai_evaluation || 'gemini', summary.url, summary.page_name, summary.browser_name,
                summary.date_test, summary.start_time_test, summary.end_time_test || null,
                summary.duration || null, summary.total_title || 0, summary.total_question || 0,
                summary.success || 0, summary.failed || 0, summary.avg_score || 0
            ]
        );

        const runId = runResult.insertId;

        // Insert test results if provided
        if (results && results.length > 0) {
            const values = results.map(r => [
                runId, r.no, r.title, r.question, r.response_kb, r.response_llm,
                r.status, r.duration, r.skor || 0, r.explanation, r.image_capture || null
            ]);
            await pool.query(
                `INSERT INTO test_results (run_id, no, title, question, response_kb, response_llm, status, duration, skor, explanation, image_path)
         VALUES ?`,
                [values]
            );
        }

        res.status(201).json({ id: runId, message: 'Test run saved' });
    } catch (err) {
        console.error('Error creating test run:', err);
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/test-runs/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM test_runs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Test run deleted' });
    } catch (err) {
        console.error('Error deleting test run:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
