const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { authenticateToken } = require('../middleware/auth');

// GET /api/presets
router.get('/', authenticateToken, async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM presets WHERE user_id = ? ORDER BY created_at DESC', [req.user.id]);
        res.json({ data: rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/presets
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, color, platform, filename, tester_name, greeting, webchat_url, telegram_bot, instagram_user, facebook_id, dhai_url } = req.body;
        const [result] = await pool.query(
            `INSERT INTO presets (user_id, name, color, platform, filename, tester_name, greeting, webchat_url, telegram_bot, instagram_user, facebook_id, dhai_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.user.id, name, color, platform, filename, tester_name, greeting, webchat_url, telegram_bot, instagram_user, facebook_id, dhai_url]
        );
        res.status(201).json({ id: result.insertId, message: 'Preset saved' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PUT /api/presets/:id
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { name, color, platform, filename, tester_name, greeting, webchat_url, telegram_bot, instagram_user, facebook_id, dhai_url } = req.body;
        await pool.query(
            `UPDATE presets SET name = ?, color = ?, platform = ?, filename = ?, tester_name = ?, greeting = ?, webchat_url = ?, telegram_bot = ?, instagram_user = ?, facebook_id = ?, dhai_url = ?
       WHERE id = ? AND user_id = ?`,
            [name, color, platform, filename, tester_name, greeting, webchat_url, telegram_bot, instagram_user, facebook_id, dhai_url, req.params.id, req.user.id]
        );
        res.json({ message: 'Preset updated' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/presets/:id
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        await pool.query('DELETE FROM presets WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
        res.json({ message: 'Preset deleted' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
