const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { testConnection } = require('./db');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
    console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));

app.use('/api/test-runs', require('./routes/test-runs'));
app.use('/api/test-results', require('./routes/test-results'));
app.use('/api/artifacts', require('./routes/artifacts'));
app.use('/api/presets', require('./routes/presets'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/schedules', require('./routes/schedules'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/judge', require('./routes/judge'));

// Serve static dashboard files
app.use(express.static(path.join(__dirname, '..')));

// Health check
app.get('/api/health', async (req, res) => {
    const dbOk = await testConnection();
    res.json({ status: dbOk ? 'ok' : 'db_error', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, async () => {
    console.log(`\n🚀 Automation Command Center Backend`);
    console.log(`   Server : http://localhost:${PORT}`);
    console.log(`   Dashboard: http://localhost:${PORT}/index.html`);
    console.log(`   API    : http://localhost:${PORT}/api\n`);
    await testConnection();
});
