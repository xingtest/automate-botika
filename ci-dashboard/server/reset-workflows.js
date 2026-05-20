const { pool } = require('./db');

async function resetWorkflows() {
  try {
    // Delete all non-template workflows
    const deleteResult = await pool.queryOriginal('DELETE FROM workflows WHERE is_template = false OR is_template IS NULL');
    console.log(`Deleted ${deleteResult.rowCount} non-template workflows.`);

    // Check templates
    const templatesResult = await pool.queryOriginal('SELECT id, name FROM workflows WHERE is_template = true');
    console.log(`Current templates in DB: ${templatesResult.rows.map(r => r.name).join(', ')}`);

  } catch (error) {
    console.error('Error resetting workflows:', error);
  } finally {
    process.exit(0);
  }
}

resetWorkflows();
