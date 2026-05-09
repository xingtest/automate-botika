const { pool } = require('../ci-dashboard/server/db');

async function migrate() {
    try {
        console.log('Running migration...');
        await pool.queryOriginal(`
            CREATE TABLE IF NOT EXISTS workflow_node_logs (
                id SERIAL PRIMARY KEY,
                execution_id VARCHAR(100) NOT NULL,
                node_id VARCHAR(100) NOT NULL,
                level VARCHAR(20) DEFAULT 'info',
                message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Table workflow_node_logs created successfully');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
