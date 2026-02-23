const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/activity
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const [rows] = await pool.query('SELECT * FROM activity_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [req.user.id, parseInt(limit)]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/activity
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, description, type } = req.body;
        const [result] = await pool.query('INSERT INTO activity_logs (user_id, title, description, type) VALUES (?, ?, ?, ?)', [req.user.id, title, description || '', type || 'system']);
        res.status(201).json({ message: 'Activity logged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/activity - Clear all
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM activity_logs WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'Activity cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
