const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function migrate() {
    try {
        console.log('🔄 Starting migration...');
        const sql = fs.readFileSync(path.join(__dirname, 'migration_user_id.sql'), 'utf-8');

        // Split by semicolon, but be careful with comments and empty strings
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await pool.query(statement);
        }

        console.log('✅ Migration successful!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}

migrate();
