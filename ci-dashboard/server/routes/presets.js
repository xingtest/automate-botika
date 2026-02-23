const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/presets
router.get('/', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM presets ORDER BY created_at DESC');
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/presets
router.post('/', async (req, res) => {
    try {
        const p = req.body;
        const [result] = await pool.query(
            `INSERT INTO presets (name, color, platform, filename, tester_name, greeting, webchat_url, telegram_bot, instagram_user, facebook_id, dhai_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [p.name, p.color || '#6366f1', p.platform, p.filename || '', p.tester_name || '', p.greeting || '', p.webchat_url || '', p.telegram_bot || '', p.instagram_user || '', p.facebook_id || '', p.dhai_url || '']
        );
        res.status(201).json({ id: result.insertId, message: 'Preset saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/presets/:id
router.put('/:id', async (req, res) => {
    try {
        const p = req.body;
        await pool.query(
            `UPDATE presets SET name=?, color=?, platform=?, filename=?, tester_name=?, greeting=?, webchat_url=?, telegram_bot=?, instagram_user=?, facebook_id=?, dhai_url=? WHERE id=?`,
            [p.name, p.color, p.platform, p.filename, p.tester_name, p.greeting, p.webchat_url, p.telegram_bot, p.instagram_user, p.facebook_id, p.dhai_url, req.params.id]
        );
        res.json({ message: 'Preset updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/presets/:id
router.delete('/:id', async (req, res) => {
    try {
        await pool.query('DELETE FROM presets WHERE id = ?', [req.params.id]);
        res.json({ message: 'Preset deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
