const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/notifications
router.get('/', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const [rows] = await pool.query('SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?', [parseInt(limit)]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications
router.post('/', async (req, res) => {
    try {
        const { title, message, type } = req.body;
        const [result] = await pool.query('INSERT INTO notifications (title, message, type) VALUES (?, ?, ?)', [title, message || '', type || 'info']);
        res.status(201).json({ id: result.insertId, message: 'Notification created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [req.params.id]);
        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/read-all
router.put('/read-all', async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE');
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/notifications
router.delete('/', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE notifications');
        res.json({ message: 'Notifications cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
