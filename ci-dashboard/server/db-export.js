const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function exportDatabase() {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupDir = path.join(__dirname, '..', '..', 'database_backup', timestamp);
        
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        console.log('🚀 Starting database export to:', backupDir);

        const TABLES = [
            'users',
            'presets',
            'workflows',
            'workflow_versions',
            'workflow_executions',
            'node_executions',
            'workflow_node_logs',
            'test_runs',
            'test_results',
            'artifacts',
            'activity_logs',
            'notifications',
            'schedules',
            'workflow_permissions'
        ];

        for (const tableName of TABLES) {
            console.log(`📦 Exporting table: ${tableName}...`);
            try {
                const [rows] = await pool.query(`SELECT * FROM ${tableName}`);
                const filePath = path.join(backupDir, `${tableName}.json`);
                fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
                console.log(`✅ Table ${tableName} exported (${rows.length} rows)`);
            } catch (err) {
                console.error(`⚠️ Could not export ${tableName}:`, err.message);
            }
        }

        console.log('✨ Export completed successfully!');
        console.log('Backup Location:', backupDir);
        process.exit(0);
    } catch (err) {
        console.error('💥 Critical error during export:', err.message);
        process.exit(1);
    }
}

exportDatabase();
