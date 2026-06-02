const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const isLocal = process.env.DB_HOST === 'localhost' || !process.env.DB_HOST;
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'automation_testing',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    ssl: isLocal ? false : { rejectUnauthorized: false }
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
        if (text.includes('IN (?)')) {
            const inIndex = pgParams.findIndex(p => Array.isArray(p));
            if (inIndex !== -1) {
                const arrayParam = pgParams[inIndex];
                const placeholders = arrayParam.map(() => '?').join(',');
                pgText = pgText.replace('IN (?)', `IN (${placeholders})`);
                const newParams = [];
                for (let i = 0; i < pgParams.length; i++) {
                    if (i === inIndex) newParams.push(...pgParams[i]);
                    else newParams.push(pgParams[i]);
                }
                pgParams = newParams;
            }
        }

        // Handle bulk INSERT (VALUES ?) expansion for PostgreSQL
        if (text.toUpperCase().includes('VALUES ?')) {
            const valuesIndex = pgParams.findIndex(p => Array.isArray(p) && Array.isArray(p[0]));
            if (valuesIndex !== -1) {
                const rows = pgParams[valuesIndex];
                const rowPlaceholders = rows.map(row => 
                    '(' + row.map(() => '?').join(',') + ')'
                ).join(',');
                pgText = pgText.replace(/VALUES\s+\?/i, `VALUES ${rowPlaceholders}`);
                
                const newParams = [];
                for (let i = 0; i < pgParams.length; i++) {
                    if (i === valuesIndex) {
                        rows.forEach(row => newParams.push(...row));
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
