const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/test-results - Get results (by run_id or search)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { run_id, status, q, limit = 100, offset = 0 } = req.query;
        let sql = 'SELECT tr.*, t.platform, t.tester_name, t.date_test FROM test_results tr JOIN test_runs t ON tr.run_id = t.id WHERE 1=1';
        const params = [];

        if (run_id) { sql += ' AND tr.run_id = ?'; params.push(run_id); }

        // Filter by user_id of the run
        sql += ' AND t.user_id = ?';
        params.push(req.user.id);

        if (status) { sql += ' AND tr.status = ?'; params.push(status); }
        if (q) { sql += ' AND (tr.question LIKE ? OR tr.title LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }

        sql += ' ORDER BY tr.id LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching test results:', err);
        res.status(500).json({ error: err.message });
    }
});

// POST /api/test-results - Batch insert results
router.post('/', async (req, res) => {
    try {
        const { run_id, results } = req.body;
        if (!run_id || !results || !results.length) {
            return res.status(400).json({ error: 'run_id and results[] required' });
        }

        const values = results.map(r => [
            run_id, r.no, r.title, r.question, r.response_kb, r.response_llm,
            r.status, r.duration, r.skor || 0, r.explanation, r.image_capture || null
        ]);

        await pool.query(
            `INSERT INTO test_results (run_id, no, title, question, response_kb, response_llm, status, duration, skor, explanation, image_path)
       VALUES ?`,
            [values]
        );

        res.status(201).json({ message: `${results.length} results inserted` });
    } catch (err) {
        console.error('Error inserting test results:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
