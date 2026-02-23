const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/schedules
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query(`
            SELECT s.*, p.name as preset_name 
            FROM schedules s 
            LEFT JOIN presets p ON s.preset_id = p.id 
            ORDER BY s.created_at DESC
        `);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/schedules
router.post('/', async (req, res) => {
    try {
        const { name, interval_min, preset_id, paused } = req.body;
        const [result] = await pool.query('INSERT INTO schedules (name, interval_min, preset_id, paused) VALUES (?, ?, ?, ?)', [name, interval_min, preset_id || null, paused || false]);
        res.status(201).json({ id: result.insertId, message: 'Schedule created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/schedules/:id
router.put('/:id', async (req, res) => {
    try {
        const { name, interval_min, preset_id, paused } = req.body;
        await pool.query('UPDATE schedules SET name = ?, interval_min = ?, preset_id = ?, paused = ? WHERE id = ?', [name, interval_min, preset_id || null, paused, req.params.id]);
        res.json({ message: 'Schedule updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/schedules/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM schedules WHERE id = ?', [req.params.id]);
        res.json({ message: 'Schedule deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
