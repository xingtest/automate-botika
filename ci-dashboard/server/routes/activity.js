const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/activity
router.get('/', async (req, res) => {
    try {
        const { limit = 50, offset = 0 } = req.query;
        const [rows] = await pool.query('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT ? OFFSET ?', [parseInt(limit), parseInt(offset)]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/activity
router.post('/', async (req, res) => {
    try {
        const { title, description, type } = req.body;
        await pool.query('INSERT INTO activity_logs (title, description, type) VALUES (?, ?, ?)', [title, description || '', type || 'system']);
        res.status(201).json({ message: 'Activity logged' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/activity - Clear all
router.delete('/', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE activity_logs');
        res.json({ message: 'Activity cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
