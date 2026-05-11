const { pool } = require('./db');
const fs = require('fs');
const path = require('path');

async function importBackup(backupPath) {
    try {
        let targetDir = backupPath;
        
        if (!targetDir) {
            const backupBaseDir = path.join(__dirname, '..', '..', 'database_backup');
            if (!fs.existsSync(backupBaseDir)) {
                console.error('❌ Error: database_backup directory not found.');
                process.exit(1);
            }
            
            const backups = fs.readdirSync(backupBaseDir)
                .filter(f => fs.statSync(path.join(backupBaseDir, f)).isDirectory())
                .sort()
                .reverse();
            
            if (backups.length === 0) {
                console.error('❌ Error: No backups found in database_backup directory.');
                process.exit(1);
            }
            
            targetDir = path.join(backupBaseDir, backups[0]);
        }

        console.log('🚀 Starting database import from:', targetDir);

        const TABLE_ORDER = [
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

        for (const tableName of TABLE_ORDER) {
            const filePath = path.join(targetDir, `${tableName}.json`);
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Skip: ${tableName}.json not found`);
                continue;
            }

            console.log(`📦 Importing table: ${tableName}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (!Array.isArray(data) || data.length === 0) {
                console.log(`ℹ️ Table ${tableName} is empty, skipping.`);
                continue;
            }

            // Get columns from first object
            const columns = Object.keys(data[0]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const columnNames = columns.join(', ');
            
            let conflictClause = '';
            if (tableName === 'workflow_permissions') {
                conflictClause = 'ON CONFLICT (workflow_id, user_id, permission) DO NOTHING';
            } else if (tableName === 'workflow_versions') {
                conflictClause = 'ON CONFLICT (workflow_id, version) DO UPDATE SET ' + 
                    columns.filter(c => !['id', 'workflow_id', 'version'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
            } else if (tableName === 'workflow_executions') {
                conflictClause = 'ON CONFLICT (execution_id) DO UPDATE SET ' + 
                    columns.filter(c => !['id', 'execution_id'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
            } else {
                conflictClause = 'ON CONFLICT (id) DO UPDATE SET ' + 
                    columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
            }

            const query = `INSERT INTO ${tableName} (${columnNames}) VALUES (${placeholders}) ${conflictClause}`;

            let successCount = 0;
            for (const row of data) {
                const values = columns.map(col => {
                    const val = row[col];
                    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
                        return JSON.stringify(val);
                    }
                    if (Array.isArray(val)) {
                        return JSON.stringify(val);
                    }
                    return val;
                });
                
                try {
                    await pool.queryOriginal(query, values);
                    successCount++;
                } catch (err) {
                    console.error(`❌ Error inserting into ${tableName}:`, err.message);
                }
            }
            
            console.log(`✅ Table ${tableName} imported (${successCount}/${data.length} rows)`);

            // Reset sequence
            try {
                await pool.queryOriginal(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), (SELECT MAX(id) FROM ${tableName}))`);
            } catch (e) {}
        }

        console.log('✨ Import completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('💥 Critical error during import:', err.message);
        process.exit(1);
    }
}

const args = process.argv.slice(2);
importBackup(args[0]);
