const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');

// Apply authentication
router.use(authenticateToken);

/**
 * POST /api/test-data/upload
 * Upload a test data file (Excel, CSV, JSON)
 */
router.post('/upload', async (req, res) => {
    try {
        const { filename, file_data } = req.body;

        if (!filename || !file_data) {
            return res.status(400).json({ error: 'Missing filename or file_data' });
        }

        // Decode base64
        const buffer = Buffer.from(file_data, 'base64');
        const ext = path.extname(filename).toLowerCase();
        
        // Determine target directory based on extension
        let targetSubDir = 'xlsx';
        if (ext === '.json') targetSubDir = 'json';
        else if (ext === '.csv') targetSubDir = 'csv';
        
        // Root assets directory
        const assetsDir = path.join(process.cwd(), 'assets', targetSubDir);
        
        // Ensure directory exists
        if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
        }

        // Sanitize filename
        const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = path.join(assetsDir, sanitizedFilename);

        // Write file
        fs.writeFileSync(filePath, buffer);
        
        console.log(`[UPLOAD] File saved to: ${filePath}`);

        res.json({ 
            success: true, 
            message: 'File uploaded successfully',
            filename: sanitizedFilename,
            path: `test-data/${sanitizedFilename}`, // Format expected by nodes
            full_path: filePath
        });
    } catch (err) {
        console.error('Upload error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
