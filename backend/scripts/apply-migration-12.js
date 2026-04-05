const oracledb = require('oracledb');

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
    const statements = [
      `DECLARE
         v_count NUMBER;
       BEGIN
         SELECT COUNT(*) INTO v_count
         FROM USER_TAB_COLUMNS
         WHERE TABLE_NAME = 'USERS' AND COLUMN_NAME = 'FULL_NAME_ENC';

         IF v_count = 0 THEN
           EXECUTE IMMEDIATE 'ALTER TABLE USERS ADD (FULL_NAME_ENC BLOB)';
         END IF;
       END;`,
      `DECLARE
         v_count NUMBER;
       BEGIN
         SELECT COUNT(*) INTO v_count
         FROM USER_TAB_COLUMNS
         WHERE TABLE_NAME = 'CUSTOMERS' AND COLUMN_NAME = 'FULL_NAME_ENC';

         IF v_count = 0 THEN
           EXECUTE IMMEDIATE 'ALTER TABLE CUSTOMERS ADD (FULL_NAME_ENC BLOB)';
         END IF;
       END;`,
    ];

    for (const statement of statements) {
      await connection.execute(statement);
    }

    await connection.commit();
    console.log('Migration 12 applied successfully');
  } finally {
    await connection.close();
  }
}

main().catch((error) => {
  console.error('Failed to apply migration 12:', error);
  process.exit(1);
});
