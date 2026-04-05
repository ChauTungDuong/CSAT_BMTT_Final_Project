const path = require('node:path');
const oracledb = require('oracledb');

const envFile = process.env.ENV_FILE
  ? path.resolve(process.cwd(), process.env.ENV_FILE)
  : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

async function main() {
  const connection = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.TNS_NAME,
    configDir: process.env.WALLET_PATH,
    walletLocation: process.env.WALLET_PATH,
    walletPassword: process.env.WALLET_PASSWORD,
  });

  try {
    const columns = await connection.execute(
      "SELECT COLUMN_NAME FROM USER_TAB_COLUMNS WHERE TABLE_NAME = 'CUSTOMERS' AND COLUMN_NAME IN ('PHONE_HASH', 'CCCD_HASH') ORDER BY COLUMN_NAME",
    );

    const indexes = await connection.execute(
      "SELECT INDEX_NAME FROM USER_INDEXES WHERE INDEX_NAME IN ('UQ_CUSTOMERS_PHONE_HASH', 'UQ_CUSTOMERS_CCCD_HASH') ORDER BY INDEX_NAME",
    );

    console.log('Columns:', columns.rows || []);
    console.log('Indexes:', indexes.rows || []);
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to verify migration 11:', error);
  process.exit(1);
});
