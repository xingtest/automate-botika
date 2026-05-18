const { pool } = require('./server/db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const sql = `INSERT INTO test_runs (user_id, test_id, run_title, platform, tester_name, filename, ai_evaluation, date_test, start_time_test, end_time_test, duration, total_title, total_question, success, failed, avg_score) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`;
    const params = [
      null,
      'WORKFLOW-TEST',
      'Workflow Judge Report - TEST',
      'llm_judge',
      'Test',
      'report.html',
      'gemini',
      '2026-05-13',
      '12:00',
      '12:01',
      '1s',
      1,
      1,
      1,
      0,
      0.5
    ];
    const res = await client.query(sql, params);
    console.log('OK', res.rows[0]);
    await client.query('ROLLBACK');
  } catch (err) {
    console.error('ERR', err.message);
    console.error(err.stack);
    await client.query('ROLLBACK');
  } finally {
    client.release();
  }
})();
