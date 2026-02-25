const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/stats/dashboard - Aggregated dashboard statistics
router.get('/dashboard', authenticateToken, async (req, res) => {
    try {
        // Total runs (exclude llm_judge)
        const [totalRows] = await pool.query("SELECT COUNT(*) as total FROM test_runs WHERE user_id = ? AND platform != 'llm_judge'", [req.user.id]);
        const totalRuns = totalRows[0].total;

        // Success rate
        const [successRows] = await pool.query("SELECT COUNT(*) as cnt FROM test_runs WHERE failed = 0 AND total_question > 0 AND user_id = ? AND platform != 'llm_judge'", [req.user.id]);
        const successRate = totalRuns > 0 ? Math.round((successRows[0].cnt / totalRuns) * 100) : 0;

        // Average score
        const [avgRows] = await pool.query("SELECT AVG(avg_score) as avg FROM test_runs WHERE avg_score > 0 AND user_id = ? AND platform != 'llm_judge'", [req.user.id]);
        const avgScore = avgRows[0].avg ? parseFloat(avgRows[0].avg).toFixed(2) : 0;

        // Platform breakdown
        const [platformRows] = await pool.query(
            "SELECT platform, COUNT(*) as runs, AVG(avg_score) as avg_score, SUM(success) as total_success, SUM(failed) as total_failed FROM test_runs WHERE user_id = ? AND platform != 'llm_judge' GROUP BY platform ORDER BY runs DESC",
            [req.user.id]
        );

        // Recent runs (last 10, exclude llm_judge)
        const [recentRows] = await pool.query("SELECT id, test_id, platform, tester_name, date_test, duration, success, failed, avg_score, created_at FROM test_runs WHERE user_id = ? AND platform != 'llm_judge' ORDER BY created_at DESC LIMIT 10", [req.user.id]);

        // Total questions tested
        const [qRows] = await pool.query("SELECT SUM(total_question) as total FROM test_runs WHERE user_id = ? AND platform != 'llm_judge'", [req.user.id]);

        res.json({
            total_runs: totalRuns,
            success_rate: successRate,
            avg_score: avgScore,
            total_questions: qRows[0].total || 0,
            platforms: platformRows,
            recent_runs: recentRows
        });
    } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        res.status(500).json({ error: err.message });
    }
});

// GET /api/stats/trends - Score trends over time
router.get('/trends', authenticateToken, async (req, res) => {
    try {
        const { days = 30, platform } = req.query;
        let sql = `SELECT date_test, platform, AVG(avg_score) as avg_score, COUNT(*) as runs, SUM(success) as success, SUM(failed) as failed
               FROM test_runs WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) AND user_id = ?`;
        const params = [parseInt(days), req.user.id];

        if (platform) { sql += ' AND platform = ?'; params.push(platform); }
        sql += ' GROUP BY date_test, platform ORDER BY date_test';

        const [rows] = await pool.query(sql, params);
        res.json({ data: rows });
    } catch (err) {
        console.error('Error fetching trends:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
