const path = require('node:path');
const oracledb = require('oracledb');

const envFile = process.env.ENV_FILE
  ? path.resolve(process.cwd(), process.env.ENV_FILE)
  : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

async function main() {
  const walletPath = process.env.WALLET_PATH;
  if (!walletPath) {
    throw new Error('WALLET_PATH is required');
  }

  const connection = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: process.env.TNS_NAME,
    configDir: walletPath,
    walletLocation: walletPath,
    walletPassword: process.env.WALLET_PASSWORD,
  });

  try {
    const statements = [
      `DECLARE
         v_count NUMBER;
       BEGIN
         SELECT COUNT(*) INTO v_count
         FROM USER_TAB_COLUMNS
         WHERE TABLE_NAME = 'CUSTOMERS' AND COLUMN_NAME = 'PHONE_HASH';

         IF v_count = 0 THEN
           EXECUTE IMMEDIATE 'ALTER TABLE CUSTOMERS ADD (PHONE_HASH VARCHAR2(64))';
         END IF;
       END;`,
      `DECLARE
         v_count NUMBER;
       BEGIN
         SELECT COUNT(*) INTO v_count
         FROM USER_TAB_COLUMNS
         WHERE TABLE_NAME = 'CUSTOMERS' AND COLUMN_NAME = 'CCCD_HASH';

         IF v_count = 0 THEN
           EXECUTE IMMEDIATE 'ALTER TABLE CUSTOMERS ADD (CCCD_HASH VARCHAR2(64))';
         END IF;
       END;`,
      `DECLARE
         v_count NUMBER;
       BEGIN
         SELECT COUNT(*) INTO v_count
         FROM USER_INDEXES
         WHERE INDEX_NAME = 'UQ_CUSTOMERS_PHONE_HASH';

         IF v_count = 0 THEN
           EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UQ_CUSTOMERS_PHONE_HASH ON CUSTOMERS(PHONE_HASH)';
         END IF;
       END;`,
      `DECLARE
         v_count NUMBER;
       BEGIN
         SELECT COUNT(*) INTO v_count
         FROM USER_INDEXES
         WHERE INDEX_NAME = 'UQ_CUSTOMERS_CCCD_HASH';

         IF v_count = 0 THEN
           EXECUTE IMMEDIATE 'CREATE UNIQUE INDEX UQ_CUSTOMERS_CCCD_HASH ON CUSTOMERS(CCCD_HASH)';
         END IF;
       END;`,
    ];

    for (const statement of statements) {
      await connection.execute(statement);
    }

    await connection.commit();
    console.log('Migration 11 applied successfully');
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to apply migration 11:', error);
  process.exit(1);
});
