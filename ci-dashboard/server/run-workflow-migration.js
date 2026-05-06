const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function runMigration() {
    try {
        console.log('🔄 Running workflow tables migration...');
        
        const migrationPath = path.join(__dirname, 'migrations', '001_create_workflow_tables.sql');
        const sql = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(sql);
        
        console.log('✅ Workflow tables created successfully!');
        console.log('   - workflows');
        console.log('   - workflow_versions');
        console.log('   - workflow_executions');
        console.log('   - node_executions');
        console.log('   - workflow_permissions');
        
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        process.exit(1);
    }
}

runMigration();
