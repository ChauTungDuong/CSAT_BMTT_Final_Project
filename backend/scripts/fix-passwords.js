/**
 * Fix password hashes in the database
 * Run: node scripts/fix-passwords.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const oracledb = require('oracledb');
const bcrypt = require('bcryptjs');

// Auto-detect outside Docker
if (!process.env.RUNNING_IN_DOCKER && process.env.DB_HOST === 'oracle') {
  process.env.DB_HOST = 'localhost';
}

async function main() {
  const password = 'Password@123';
  const hash = await bcrypt.hash(password, 12);
  console.log('Generated hash:', hash);
  console.log('Hash length:', hash.length);

  const conn = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
  });

  const result = await conn.execute(
    'UPDATE USERS SET PASSWORD_HASH = :h',
    { h: hash },
    { autoCommit: true },
  );
  console.log('Updated rows:', result.rowsAffected);

  // Verify
  const r2 = await conn.execute(
    'SELECT USERNAME, LENGTH(PASSWORD_HASH) as len FROM USERS ORDER BY 1',
  );
  console.log('\nVerification:');
  r2.rows.forEach((row) => console.log(` ${row[0]}: hash length = ${row[1]}`));

  // Test bcrypt compare
  const r3 = await conn.execute(
    "SELECT PASSWORD_HASH FROM USERS WHERE USERNAME='admin1'",
  );
  const stored = r3.rows[0][0];
  const match = await bcrypt.compare(password, stored);
  console.log(
    `\nBcrypt verify for admin1: ${match ? '✅ MATCH' : '❌ MISMATCH'}`,
  );

  await conn.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
