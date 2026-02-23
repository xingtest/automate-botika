const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'automation_testing',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    charset: 'utf8mb4'
});

// Test connection on startup
async function testConnection() {
    try {
        const conn = await pool.getConnection();
        console.log('✅ MySQL connected successfully');
        conn.release();
        return true;
    } catch (err) {
        console.error('❌ MySQL connection failed:', err.message);
        return false;
    }
}

module.exports = { pool, testConnection };
