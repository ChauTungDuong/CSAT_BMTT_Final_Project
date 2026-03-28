/**
 * Fix password hashes in the database
 * Run: node scripts/fix-passwords.js --mode=cloud
 *      node scripts/fix-passwords.js --mode=local
 */
const path = require('node:path');

const envFile = process.env.ENV_FILE
  ? path.resolve(process.cwd(), process.env.ENV_FILE)
  : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

const args = process.argv.slice(2);
function getArgValue(flagName) {
  const prefix = `${flagName}=`;
  const match = args.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

const runtimeMode = (
  getArgValue('--mode') ||
  process.env.DB_CONNECTION_MODE ||
  'cloud'
)
  .toLowerCase()
  .trim();

const oracledb = require('oracledb');
const bcrypt = require('bcryptjs');

function buildConnectionOptions() {
  if (runtimeMode === 'local') {
    let host = process.env.DB_HOST || 'localhost';
    if (!process.env.RUNNING_IN_DOCKER && host === 'oracle') {
      host = 'localhost';
    }
    const port = process.env.DB_PORT || '1521';
    const service = process.env.DB_SERVICE || 'XEPDB1';
    return {
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      connectString: `${host}:${port}/${service}`,
    };
  }

  if (!process.env.WALLET_PATH || !process.env.TNS_NAME) {
    throw new Error(
      'Cloud mode requires WALLET_PATH and TNS_NAME in environment file',
    );
  }

  return {
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.TNS_NAME,
    configDir: process.env.WALLET_PATH,
    walletLocation: process.env.WALLET_PATH,
    walletPassword: process.env.WALLET_PASSWORD,
  };
}

async function main() {
  console.log(`Running password fix in mode: ${runtimeMode}`);
  const password = 'Password@123';
  const hash = await bcrypt.hash(password, 12);
  console.log('Generated hash:', hash);
  console.log('Hash length:', hash.length);

  const conn = await oracledb.getConnection(buildConnectionOptions());

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
