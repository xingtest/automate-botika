const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/schedules
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.*, p.name as preset_name 
            FROM schedules s 
            LEFT JOIN presets p ON s.preset_id = p.id 
            WHERE s.user_id = ?
            ORDER BY s.created_at DESC
        `, [req.user.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/schedules
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, interval_min, preset_id, paused } = req.body;
        const [result] = await pool.query('INSERT INTO schedules (user_id, name, interval_min, preset_id, paused) VALUES (?, ?, ?, ?, ?)', [req.user.id, name, interval_min, preset_id || null, paused || false]);
        res.status(201).json({ id: result.insertId, message: 'Schedule created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/schedules/:id
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, interval_min, preset_id, paused } = req.body;
        await pool.query('UPDATE schedules SET name = ?, interval_min = ?, preset_id = ?, paused = ? WHERE id = ? AND user_id = ?', [name, interval_min, preset_id || null, paused, req.params.id, req.user.id]);
        res.json({ message: 'Schedule updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/schedules/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM schedules WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
