// Usage:
//   node scripts/migrate-remove-cell-hmac.js --mode=cloud
//   node scripts/migrate-remove-cell-hmac.js --mode=local

const path = require('path');
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

function toBuffer(value) {
  if (!value) return null;
  if (Buffer.isBuffer(value)) return value;
  return Buffer.from(String(value), 'utf8');
}

function sanitizeEncryptedCellBuffer(rawBuffer) {
  const buf = toBuffer(rawBuffer);
  if (!buf) return { changed: false, output: null };

  const rawText = buf.toString('utf8');
  let parsed;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    return { changed: false, output: null };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { changed: false, output: null };
  }

  if (parsed.type !== 'encrypted' || parsed.algo !== 'aes-256-gcm') {
    return { changed: false, output: null };
  }

  if (!Object.prototype.hasOwnProperty.call(parsed, 'hmac')) {
    return { changed: false, output: null };
  }

  delete parsed.hmac;
  const output = Buffer.from(JSON.stringify(parsed), 'utf8');
  return { changed: true, output };
}

async function migrateTableColumn(conn, tableName, idColumn, dataColumn) {
  const fetchInfo = {};
  fetchInfo[dataColumn] = { type: oracledb.BUFFER };

  const selectSql = `
    SELECT ${idColumn} AS ID_VALUE, ${dataColumn}
    FROM ${tableName}
    WHERE ${dataColumn} IS NOT NULL
  `;

  const result = await conn.execute(selectSql, [], {
    outFormat: oracledb.OUT_FORMAT_OBJECT,
    fetchInfo,
  });

  const rows = result.rows || [];
  let updated = 0;

  const updateSql = `
    UPDATE ${tableName}
       SET ${dataColumn} = :blobValue
     WHERE ${idColumn} = :idValue
  `;

  for (const row of rows) {
    const cell = row[dataColumn];
    const sanitized = sanitizeEncryptedCellBuffer(cell);
    if (!sanitized.changed || !sanitized.output) {
      continue;
    }

    await conn.execute(updateSql, {
      blobValue: { val: sanitized.output, type: oracledb.BUFFER },
      idValue: row.ID_VALUE,
    });

    updated += 1;
  }

  return { scanned: rows.length, updated };
}

async function main() {
  console.log(`Running remove-cell-hmac migration in mode: ${runtimeMode}`);

  const conn = await oracledb.getConnection(buildConnectionOptions());

  try {
    const targets = [
      { table: 'CUSTOMERS', id: 'ID', column: 'PHONE' },
      { table: 'CUSTOMERS', id: 'ID', column: 'CCCD' },
      { table: 'CUSTOMERS', id: 'ID', column: 'DATE_OF_BIRTH' },
      { table: 'CUSTOMERS', id: 'ID', column: 'ADDRESS' },
      { table: 'ACCOUNTS', id: 'ID', column: 'ACCOUNT_NUMBER' },
      { table: 'ACCOUNTS', id: 'ID', column: 'BALANCE' },
      { table: 'CARDS', id: 'ID', column: 'CARD_NUMBER' },
      { table: 'CARDS', id: 'ID', column: 'CVV' },
      { table: 'CARDS', id: 'ID', column: 'CARD_EXPIRY' },
      { table: 'TRANSACTIONS', id: 'ID', column: 'AMOUNT' },
    ];

    let totalScanned = 0;
    let totalUpdated = 0;

    for (const target of targets) {
      const stats = await migrateTableColumn(
        conn,
        target.table,
        target.id,
        target.column,
      );

      totalScanned += stats.scanned;
      totalUpdated += stats.updated;

      console.log(
        `${target.table}.${target.column}: scanned=${stats.scanned}, updated=${stats.updated}`,
      );
    }

    await conn.commit();
    console.log(
      `Done. Total scanned=${totalScanned}, total updated=${totalUpdated}`,
    );
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message || err);
  process.exit(1);
});
