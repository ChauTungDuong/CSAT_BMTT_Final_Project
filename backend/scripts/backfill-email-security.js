// Usage:
//   node scripts/backfill-email-security.js --mode=cloud
//   node scripts/backfill-email-security.js --mode=local

const path = require('node:path');
const crypto = require('node:crypto');
const oracledb = require('oracledb');

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

const aesMasterKeyHex = (process.env.AES_MASTER_KEY || '').trim().toLowerCase();
if (!/^[0-9a-f]{64}$/.test(aesMasterKeyHex)) {
  throw new Error('AES_MASTER_KEY must be 64 hex chars');
}

const hashKeyHex = (process.env.EMAIL_HASH_KEY || aesMasterKeyHex)
  .trim()
  .toLowerCase();
if (!/^[0-9a-f]{64}$/.test(hashKeyHex)) {
  throw new Error('EMAIL_HASH_KEY must be 64 hex chars');
}

const encryptionKey = Buffer.from(aesMasterKeyHex, 'hex');
const hashKey = Buffer.from(hashKeyHex, 'hex');

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
    throw new Error('Cloud mode requires WALLET_PATH and TNS_NAME');
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

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function hashEmail(email) {
  return crypto
    .createHmac('sha256', hashKey)
    .update(normalizeEmail(email), 'utf8')
    .digest('hex');
}

function encryptEmail(email) {
  const normalized = normalizeEmail(email);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(normalized, 'utf8')),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return Buffer.from(
    JSON.stringify({
      type: 'encrypted',
      algo: 'aes-256-gcm',
      payload: ciphertext.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    }),
    'utf8',
  );
}

async function backfillTable(conn, tableName) {
  const idColumn = tableName === 'USERS' ? 'ID' : 'ID';
  const rows = await conn.execute(
    `SELECT ${idColumn}, EMAIL_HASH FROM ${tableName}`,
  );

  let updated = 0;
  for (const row of rows.rows || []) {
    const id = row[0];
    const currentHash = row[1];

    // In encrypted-only schema, plaintext source is no longer available.
    // Keep script focused on hash consistency for records already written by app/seed.
    if (!currentHash) continue;

    const emailHash = String(currentHash).toLowerCase();
    if (currentHash === emailHash) {
      continue;
    }

    await conn.execute(
      `UPDATE ${tableName}
       SET EMAIL_HASH = :emailHash,
           UPDATED_AT = SYSTIMESTAMP
       WHERE ${idColumn} = :id`,
      {
        id,
        emailHash,
      },
    );
    updated += 1;
  }

  return updated;
}

async function main() {
  const conn = await oracledb.getConnection(buildConnectionOptions());
  try {
    const usersUpdated = await backfillTable(conn, 'USERS');
    const customersUpdated = await backfillTable(conn, 'CUSTOMERS');
    await conn.commit();

    console.log(
      `Backfill done. USERS updated: ${usersUpdated}, CUSTOMERS updated: ${customersUpdated}`,
    );
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error('Backfill failed:', err.message || err);
  process.exit(1);
});
