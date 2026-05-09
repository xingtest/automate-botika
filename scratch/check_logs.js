const { pool } = require('../ci-dashboard/server/db');

async function check() {
    try {
        const res = await pool.queryOriginal(`
            SELECT * FROM workflow_node_logs 
            ORDER BY created_at DESC 
            LIMIT 20
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
check();
