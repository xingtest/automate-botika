const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { pool } = require('../db');

// Ensure artifacts directory exists
const artifactsDir = path.join(__dirname, '..', '..', 'artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

// GET /api/artifacts - List artifacts for a test run
router.get('/', async (req, res) => {
  try {
    const { run_id, artifact_type, limit = 100, offset = 0 } = req.query;
    let sql = 'SELECT * FROM artifacts WHERE 1=1';
    const params = [];

    if (run_id) { sql += ' AND run_id = ?'; params.push(run_id); }
    if (artifact_type) { sql += ' AND artifact_type = ?'; params.push(artifact_type); }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const [rows] = await pool.query(sql, params);
    res.json({ data: rows });
  } catch (err) {
    console.error('Error fetching artifacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artifacts/run/:run_id - Get all artifacts for a specific run
router.get('/run/:run_id', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM artifacts WHERE run_id = ? ORDER BY artifact_type, created_at DESC',
      [req.params.run_id]
    );
    res.json({ data: rows });
  } catch (err) {
    console.error('Error fetching run artifacts:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/artifacts - Create artifact record (receives file as base64)
router.post('/', async (req, res) => {
  try {
    const { run_id, artifact_type, filename, file_data, description } = req.body;

    if (!run_id || !artifact_type || !filename || !file_data) {
      return res.status(400).json({ error: 'Missing required fields: run_id, artifact_type, filename, file_data' });
    }

    // Decode base64 and write to disk
    const buffer = Buffer.from(file_data, 'base64');
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = path.join(artifactsDir, `${run_id}_${Date.now()}_${sanitizedFilename}`);

    fs.writeFileSync(filePath, buffer);
    const fileSize = buffer.length;

    // Determine MIME type
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.json': 'application/json',
      '.html': 'text/html',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.xls': 'application/vnd.ms-excel',
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.zip': 'application/zip'
    };
    const mimeType = mimeTypes[ext] || 'application/octet-stream';

    // Store in database
    const [result] = await pool.query(
      `INSERT INTO artifacts (run_id, artifact_type, filename, file_path, file_size, mime_type, description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [run_id, artifact_type, filename, path.relative(artifactsDir, filePath), fileSize, mimeType, description || null]
    );

    res.status(201).json({
      id: result.insertId,
      run_id,
      artifact_type,
      filename,
      file_size: fileSize,
      mime_type: mimeType
    });
  } catch (err) {
    console.error('Error creating artifact:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artifacts/:id/download - Download artifact
router.get('/:id/download', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM artifacts WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const artifact = rows[0];
    const filePath = path.join(artifactsDir, artifact.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    // Set appropriate headers
    res.setHeader('Content-Type', artifact.mime_type);
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.filename}"`);
    res.setHeader('Content-Length', artifact.file_size);

    // Send file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (err) {
    console.error('Error downloading artifact:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/artifacts/:id/view - View artifact (for HTML/JSON/images)
router.get('/:id/view', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM artifacts WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const artifact = rows[0];
    const filePath = path.join(artifactsDir, artifact.file_path);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on disk' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    
    if (artifact.artifact_type === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.send(content);
    } else if (artifact.artifact_type === 'html') {
      res.setHeader('Content-Type', 'text/html');
      res.send(content);
    } else {
      res.send(content);
    }
  } catch (err) {
    console.error('Error viewing artifact:', err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/artifacts/:id - Delete artifact
router.delete('/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM artifacts WHERE id = ?', [req.params.id]);
    if (!rows.length) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const artifact = rows[0];
    const filePath = path.join(artifactsDir, artifact.file_path);

    // Delete file from disk
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await pool.query('DELETE FROM artifacts WHERE id = ?', [req.params.id]);

    res.json({ message: 'Artifact deleted' });
  } catch (err) {
    console.error('Error deleting artifact:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
