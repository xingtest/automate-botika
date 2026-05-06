const fs = require('fs');
const path = require('path');
const db = require('./db');

async function runMigration() {
  try {
    console.log('🚀 Running workflow tables migration...');
    
    const migrationPath = path.join(__dirname, 'migrations', '001_add_workflow_tables.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('   - workflows table created');
    console.log('   - workflow_versions table created');
    console.log('   - workflow_executions table created');
    console.log('   - node_executions table created');
    console.log('   - workflow_permissions table created');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
