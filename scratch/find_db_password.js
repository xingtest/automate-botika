const { Pool } = require('pg');

const passwords = ['admin', 'postgres', 'password', '123456', 'root', ''];

async function findPassword() {
    for (const pwd of passwords) {
        console.log(`Trying password: "${pwd}"...`);
        const pool = new Pool({
            host: 'localhost',
            port: 5432,
            user: 'postgres',
            password: pwd,
            connectionTimeoutMillis: 2000,
        });

        try {
            const client = await pool.connect();
            console.log(`✅ SUCCESS! The password is: "${pwd}"`);
            client.release();
            await pool.end();
            process.exit(0);
        } catch (err) {
            console.log(`❌ Failed: ${err.message}`);
        }
        await pool.end();
    }
    console.log('🛑 None of the common passwords worked.');
    process.exit(1);
}

findPassword();
