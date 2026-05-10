const { pool } = require('../ci-dashboard/server/db');
const fs = require('fs');
const path = require('path');

const BACKUP_DIR = path.join(__dirname, '..', 'database_backup', '2026-05-09T14-01-23-130Z');

const TABLE_FILES = [
    { table: 'users', file: 'users.json' },
    { table: 'presets', file: 'presets.json' },
    { table: 'workflows', file: 'workflows.json' },
    { table: 'workflow_versions', file: 'workflow_versions.json' },
    { table: 'workflow_executions', file: 'workflow_executions.json' },
    { table: 'node_executions', file: 'node_executions.json' },
    { table: 'workflow_node_logs', file: 'workflow_node_logs.json' },
    { table: 'test_runs', file: 'test_runs.json' },
    { table: 'test_results', file: 'test_results.json' },
    { table: 'artifacts', file: 'artifacts.json' },
    { table: 'activity_logs', file: 'activity_logs.json' },
    { table: 'notifications', file: 'notifications.json' },
    { table: 'schedules', file: 'schedules.json' },
    { table: 'workflow_permissions', file: 'workflow_permissions.json' }
];

async function importBackup() {
    try {
        console.log('🚀 Starting database import from:', BACKUP_DIR);

        for (const item of TABLE_FILES) {
            const filePath = path.join(BACKUP_DIR, item.file);
            if (!fs.existsSync(filePath)) {
                console.log(`⚠️ Skip: ${item.file} not found`);
                continue;
            }

            console.log(`📦 Importing table: ${item.table}...`);
            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            if (!Array.isArray(data) || data.length === 0) {
                console.log(`ℹ️ Table ${item.table} is empty, skipping.`);
                continue;
            }

            // Get columns from first object
            const columns = Object.keys(data[0]);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            const columnNames = columns.join(', ');
            
            // Build ON CONFLICT clause
            // Most tables have 'id' as PK. 
            // workflow_permissions has UNIQUE(workflow_id, user_id, permission)
            // workflow_versions has UNIQUE(workflow_id, version)
            // workflow_executions has UNIQUE(execution_id)
            let conflictClause = 'ON CONFLICT (id) DO UPDATE SET ' + 
                columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ');
            
            if (item.table === 'workflow_permissions') {
                conflictClause = 'ON CONFLICT (workflow_id, user_id, permission) DO UPDATE SET ' + 
                    columns.filter(c => !['id', 'workflow_id', 'user_id', 'permission'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
                if (conflictClause.endsWith('SET ')) conflictClause = 'ON CONFLICT (workflow_id, user_id, permission) DO NOTHING';
            } else if (item.table === 'workflow_versions') {
                conflictClause = 'ON CONFLICT (workflow_id, version) DO UPDATE SET ' + 
                    columns.filter(c => !['id', 'workflow_id', 'version'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
            } else if (item.table === 'workflow_executions') {
                conflictClause = 'ON CONFLICT (execution_id) DO UPDATE SET ' + 
                    columns.filter(c => !['id', 'execution_id'].includes(c)).map(c => `${c} = EXCLUDED.${c}`).join(', ');
            } else if (item.table === 'node_executions') {
                 // node_executions doesn't have a simple unique constraint besides ID in schema, but usually it's unique per execution+node
                 // For now, stick to ID conflict
            }

            const query = `INSERT INTO ${item.table} (${columnNames}) VALUES (${placeholders}) ${conflictClause}`;

            for (const row of data) {
                const values = columns.map(col => {
                    const val = row[col];
                    // Convert objects/arrays to JSON string for JSONB columns
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
                } catch (err) {
                    console.error(`❌ Error inserting into ${item.table}:`, err.message);
                    console.error('Row:', row);
                }
            }
            
            console.log(`✅ Table ${item.table} imported (${data.length} rows)`);

            // Reset sequence if table has serial ID
            try {
                await pool.queryOriginal(`SELECT setval(pg_get_serial_sequence('${item.table}', 'id'), (SELECT MAX(id) FROM ${item.table}))`);
            } catch (e) {
                // Ignore if no sequence
            }
        }

        console.log('✨ Import completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('💥 Critical error during import:', err.message);
        process.exit(1);
    }
}

importBackup();
