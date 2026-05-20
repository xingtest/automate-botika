const { pool } = require('./db');

async function insertTemplates() {
  const templates = [
    { name: 'Webchat Testing', platformType: 'playwright-webchat', platformLabel: 'Webchat' },
    { name: 'Facebook Testing', platformType: 'playwright-facebook', platformLabel: 'Facebook DM' },
    { name: 'Instagram Testing', platformType: 'playwright-instagram', platformLabel: 'Instagram DM' },
    { name: 'Telegram Testing', platformType: 'telegram', platformLabel: 'Telegram Bot' }
  ];

  try {
    for (const t of templates) {
      const definition = {
        nodes: [
          { id: 'node_1', type: 'manual-trigger', data: { label: 'Start' }, position: { x: 100, y: 150 } },
          { id: 'node_2', type: 'read-excel', data: { label: 'Read Excel / CSV', config: {} }, position: { x: 350, y: 150 } },
          { id: 'node_3', type: t.platformType, data: { label: t.platformLabel, config: {} }, position: { x: 600, y: 150 } },
          { id: 'node_4', type: 'ai-evaluate', data: { label: 'AI Evaluate', config: {} }, position: { x: 850, y: 150 } },
          { id: 'node_5', type: 'generate-report', data: { label: 'Final Report', config: {} }, position: { x: 1100, y: 150 } }
        ],
        edges: [
          { id: 'e1-2', source: 'node_1', target: 'node_2', sourceHandle: 'main', targetHandle: 'main' },
          { id: 'e2-3', source: 'node_2', target: 'node_3', sourceHandle: 'main', targetHandle: 'main' },
          { id: 'e3-4', source: 'node_3', target: 'node_4', sourceHandle: 'main', targetHandle: 'main' },
          { id: 'e4-5', source: 'node_4', target: 'node_5', sourceHandle: 'main', targetHandle: 'main' }
        ]
      };

      const canvasState = { zoom: 1, panX: 0, panY: 0 };
      const desc = `Template workflow pengujian otomatis untuk ${t.platformLabel}.`;

      // Check if already exists to avoid duplicates
      const exists = await pool.queryOriginal('SELECT id FROM workflows WHERE name = $1 AND is_template = true', [t.name]);
      if (exists.rows.length === 0) {
        await pool.queryOriginal(
          `INSERT INTO workflows (user_id, name, description, definition, canvas_state, is_template, is_public, version)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [1, t.name, desc, JSON.stringify(definition), JSON.stringify(canvasState), true, true, 1]
        );
        console.log(`Inserted template: ${t.name}`);
      } else {
        console.log(`Template already exists: ${t.name}`);
      }
    }
    console.log('All templates processed!');
  } catch (error) {
    console.error('Error inserting templates:', error);
  } finally {
    process.exit(0);
  }
}

insertTemplates();
