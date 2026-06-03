const { pool } = require('./db');

async function rebuildTemplates() {
  const templates = [
    { name: 'Webchat Testing', platformType: 'playwright-webchat', platformLabel: 'Webchat', icon: 'fa-comments', color: '#2b6cb0' },
    { name: 'Facebook Testing', platformType: 'playwright-facebook', platformLabel: 'Facebook DM', icon: 'fab fa-facebook', color: '#1877F2' },
    { name: 'Instagram Testing', platformType: 'playwright-instagram', platformLabel: 'Instagram DM', icon: 'fab fa-instagram', color: '#E1306C' },
    { name: 'Telegram Testing', platformType: 'telegram', platformLabel: 'Telegram Client', icon: 'fa-paper-plane', color: '#0088cc' },
    { name: 'WhatsApp Testing', platformType: 'playwright-whatsapp', platformLabel: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366' }
  ];

  try {
    await pool.queryOriginal('DELETE FROM workflows WHERE is_template = true');
    console.log('Cleared all templates from database.');

    for (const t of templates) {
      const definition = {
        nodes: [
          { 
            id: 'node_1', 
            type: 'manual-trigger', 
            label: 'Manual Trigger', 
            icon: 'fa-hand-pointer',
            color: '#f59e0b',
            x: 100, 
            y: 150,
            config: {},
            inputs: [],
            outputs: [{ id: 'main', label: 'Output' }]
          },
          { 
            id: 'node_2', 
            type: 'read-excel', 
            label: 'Read Excel / CSV', 
            icon: 'fa-file-excel',
            color: '#1d6f42',
            x: 400, 
            y: 150,
            config: {},
            inputs: [{ id: 'main', label: 'Input' }],
            outputs: [{ id: 'main', label: 'Output' }]
          },
          { 
            id: 'node_3', 
            type: t.platformType, 
            label: t.platformLabel, 
            icon: t.icon,
            color: t.color,
            x: 700, 
            y: 150,
            config: {},
            inputs: [{ id: 'main', label: 'Input' }],
            outputs: [{ id: 'main', label: 'Output' }]
          },
          { 
            id: 'node_4', 
            type: 'ai-evaluate', 
            label: 'AI Evaluate', 
            icon: 'fa-brain',
            color: '#8b5cf6',
            x: 1000, 
            y: 150,
            config: {},
            inputs: [{ id: 'main', label: 'Input' }],
            outputs: [{ id: 'main', label: 'Output' }]
          },
          { 
            id: 'node_5', 
            type: 'generate-report', 
            label: 'Generate Report', 
            icon: 'fa-file-alt',
            color: '#10b981',
            x: 1300, 
            y: 150,
            config: {},
            inputs: [{ id: 'main', label: 'Input' }],
            outputs: [{ id: 'main', label: 'Output' }]
          }
        ],
        connections: [
          { source_node_id: 'node_1', target_node_id: 'node_2', source_port_id: 'main', target_port_id: 'main' },
          { source_node_id: 'node_2', target_node_id: 'node_3', source_port_id: 'main', target_port_id: 'main' },
          { source_node_id: 'node_3', target_node_id: 'node_4', source_port_id: 'main', target_port_id: 'main' },
          { source_node_id: 'node_4', target_node_id: 'node_5', source_port_id: 'main', target_port_id: 'main' }
        ]
      };

      const canvasState = { zoom: 1, panX: 0, panY: 0 };
      const desc = `Template workflow pengujian otomatis untuk ${t.platformLabel}.`;

      await pool.queryOriginal(
        `INSERT INTO workflows (user_id, name, description, definition, canvas_state, is_template, is_public, version)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [1, t.name, desc, JSON.stringify(definition), JSON.stringify(canvasState), true, true, 1]
      );
      console.log(`Inserted clean template with exact library styling: ${t.name}`);
    }
    console.log('Templates successfully rebuilt!');
  } catch (error) {
    console.error('Error rebuilding templates:', error);
  } finally {
    process.exit(0);
  }
}

rebuildTemplates();
