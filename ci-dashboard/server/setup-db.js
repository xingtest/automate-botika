const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function init() {
    try {
        console.log('🔄 Initializing PostgreSQL database...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const sql = fs.readFileSync(schemaPath, 'utf8');

        // Split by semicolon and execute
        // This is a simple split, might fail if semicolons are inside strings
        const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        for (const statement of statements) {
            console.log(`Executing: ${statement.substring(0, 50)}...`);
            await pool.queryOriginal(statement);
        }

        console.log('✅ PostgreSQL initialization successful!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Initialization failed:', err.message);
        console.error('Make sure the database "automation_testing" exists and PostgreSQL is running.');
        process.exit(1);
    }
}

init();
