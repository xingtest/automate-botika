const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/notifications
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const [rows] = await pool.query('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?', [req.user.id, parseInt(limit)]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/notifications
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { title, message, type } = req.body;
        const [result] = await pool.query('INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)', [req.user.id, title, message || '', type || 'info']);
        res.status(201).json({ id: result.insertId, message: 'Notification created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Notification marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/notifications/read-all
router.put('/read-all', authenticateToken, async (req, res) => {
    try {
        await pool.query('UPDATE notifications SET is_read = TRUE WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'All notifications marked as read' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/notifications
router.delete('/', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM notifications WHERE user_id = ?', [req.user.id]);
        res.json({ message: 'Notifications cleared' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
