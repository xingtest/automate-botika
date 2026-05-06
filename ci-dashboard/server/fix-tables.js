const { pool } = require('./db');
async function migrate() {
    try {
        console.log('Creating notifications table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                message TEXT,
                type VARCHAR(50) DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_n_read ON notifications(is_read)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_n_created ON notifications(created_at)');

        console.log('Creating schedules table...');
        await pool.query(`
            CREATE TABLE IF NOT EXISTS schedules (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                interval_min INT NOT NULL,
                preset_id INT NULL,
                paused BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (preset_id) REFERENCES presets(id) ON DELETE SET NULL
            )
        `);
        await pool.query('CREATE INDEX IF NOT EXISTS idx_s_paused ON schedules(paused)');

        console.log('✅ Tables created successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Migration failed:', err.message);
        process.exit(1);
    }
}
migrate();
