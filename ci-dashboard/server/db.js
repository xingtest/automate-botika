const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'automation_testing',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

/**
 * Wrapper to mimic mysql2 query behavior for PostgreSQL
 * 1. Converts '?' placeholders to '$1, $2, ...'
 * 2. Returns [rows/header, fields] instead of result object
 * 3. Handles 'INSERT' by automatically adding 'RETURNING id' if missing
 * 4. Expands 'IN (?)' if the parameter is an array
 */
const originalQuery = pool.query.bind(pool);
pool.queryOriginal = originalQuery;
pool.query = async function (text, params = []) {
    let pgText = text;
    let pgParams = [...params];

    if (typeof text === 'string') {
        // Handle IN (?) expansion
        // Note: This is a simple implementation. If there are multiple IN (?) it might get tricky.
        if (text.includes('IN (?)')) {
            const inIndex = pgParams.findIndex(p => Array.isArray(p));
            if (inIndex !== -1) {
                const arrayParam = pgParams[inIndex];
                const placeholders = arrayParam.map(() => '?').join(',');
                pgText = pgText.replace('IN (?)', `IN (${placeholders})`);
                // Flatten pgParams
                const newParams = [];
                for (let i = 0; i < pgParams.length; i++) {
                    if (i === inIndex) {
                        newParams.push(...pgParams[i]);
                    } else {
                        newParams.push(pgParams[i]);
                    }
                }
                pgParams = newParams;
            }
        }

        // Convert ? to $1, $2...
        let count = 0;
        pgText = pgText.replace(/\?/g, () => `$${++count}`);

        // Automatically add RETURNING id for INSERT if it's missing and we want insertId
        const trimmed = pgText.trim().toUpperCase();
        if (trimmed.startsWith('INSERT INTO') && !trimmed.includes('RETURNING')) {
            pgText += ' RETURNING id';
        }
    }

    try {
        const res = await originalQuery(pgText, pgParams);

        // Mimic mysql2 return format [rows/header, fields]
        if (typeof text === 'string') {
            const trimmed = text.trim().toUpperCase();
            if (trimmed.startsWith('INSERT INTO')) {
                const header = {
                    insertId: res.rows[0]?.id,
                    affectedRows: res.rowCount
                };
                return [header, res.fields];
            }
            if (trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE')) {
                const header = {
                    affectedRows: res.rowCount,
                    changedRows: res.rowCount // mysql2 specific
                };
                return [header, res.fields];
            }
        }

        return [res.rows, res.fields];
    } catch (err) {
        console.error('❌ Database Query Error:', err.message);
        console.error('SQL:', pgText);
        console.error('Params:', pgParams);
        throw err;
    }
};

async function testConnection() {
    try {
        const client = await pool.connect();
        console.log('✅ PostgreSQL connected successfully');
        client.release();
        return true;
    } catch (err) {
        console.error('❌ PostgreSQL connection failed:', err.message);
        return false;
    }
}

module.exports = { pool, testConnection };
