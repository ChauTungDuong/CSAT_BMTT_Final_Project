// Usage:
//   node scripts/seed-customers.js --mode=cloud
//   node scripts/seed-customers.js --mode=local
//   node scripts/seed-customers.js --mode=cloud --fresh

const path = require('node:path');
const crypto = require('crypto');
const oracledb = require('oracledb');

const envFile = process.env.ENV_FILE
  ? path.resolve(process.cwd(), process.env.ENV_FILE)
  : path.join(__dirname, '../.env');
require('dotenv').config({ path: envFile });

const args = process.argv.slice(2);
const fresh = args.includes('--fresh');

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

const aesMasterKeyHex = (process.env.AES_MASTER_KEY || '').trim();
const dekRecoveryKeyHex = (process.env.DEK_RECOVERY_KEY || '').trim();

if (!/^[0-9a-fA-F]{64}$/.test(aesMasterKeyHex)) {
  throw new Error('AES_MASTER_KEY must be 64 hex chars');
}

const masterKey = Buffer.from(aesMasterKeyHex, 'hex');
const recoveryKey = /^[0-9a-fA-F]{64}$/.test(dekRecoveryKeyHex)
  ? Buffer.from(dekRecoveryKeyHex, 'hex')
  : null;

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

function hmacSha256(key, data) {
  return crypto.createHmac('sha256', key).update(data).digest();
}

function pbkdf2Manual(secret, salt, iterations, dkLen) {
  const hLen = 32;
  const l = Math.ceil(dkLen / hLen);
  const out = Buffer.alloc(l * hLen);
  const key = Buffer.from(secret, 'utf8');

  for (let block = 1; block <= l; block++) {
    const intBlock = Buffer.alloc(4);
    intBlock.writeUInt32BE(block, 0);

    let u = hmacSha256(key, Buffer.concat([salt, intBlock]));
    const t = Buffer.from(u);

    for (let c = 2; c <= iterations; c++) {
      u = hmacSha256(key, u);
      for (let j = 0; j < t.length; j++) {
        t[j] ^= u[j];
      }
    }

    t.copy(out, (block - 1) * hLen);
  }

  return out.subarray(0, dkLen);
}

function hashSecret(secret, purpose) {
  const iterations = purpose === 'pin' ? 220000 : 310000;
  const salt = crypto.randomBytes(16);
  const derived = pbkdf2Manual(secret, salt, iterations, 32);
  return [
    'pbkdf2',
    'sha256',
    String(iterations),
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$');
}

function deriveKek(password, saltHex, iterations, keyLength = 32) {
  return pbkdf2Manual(
    password,
    Buffer.from(saltHex, 'hex'),
    iterations,
    keyLength,
  );
}

function encryptCellWithKey(key, plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(Buffer.from(String(plaintext), 'utf8')),
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

function wrapDekWithKey(kek, dek) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const ciphertext = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    payload: ciphertext.toString('base64'),
  });
}

function hashAccountNumber(accountNumber) {
  return hmacSha256(
    masterKey,
    Buffer.from(accountNumber.trim(), 'utf8'),
  ).toString('hex');
}

const admins = [
  {
    id: 'USR-ADMIN-001',
    username: 'admin1',
    fullName: 'System Admin 1',
    email: 'admin1@bank.local',
    adminPin: '123456',
  },
  {
    id: 'USR-ADMIN-002',
    username: 'admin2',
    fullName: 'System Admin 2',
    email: 'admin2@bank.local',
    adminPin: '123456',
  },
];

const customers = [
  {
    userId: 'USR-CUST-001',
    customerId: 'CUS-CUST-001',
    accountId: 'ACC-CUST-001',
    username: 'customer01',
    fullName: 'Nguyen Van An',
    email: 'customer01@bank.local',
    phone: '0901111111',
    cccd: '079204001001',
    dob: '15/03/1990',
    address: '123 Le Loi, Quan 1, TP.HCM',
    accountNumber: 'VN1000000001',
    balance: '1500000',
    pin: '123456',
  },
  {
    userId: 'USR-CUST-002',
    customerId: 'CUS-CUST-002',
    accountId: 'ACC-CUST-002',
    username: 'customer02',
    fullName: 'Tran Thi Binh',
    email: 'customer02@bank.local',
    phone: '0901111112',
    cccd: '079204001002',
    dob: '22/07/1995',
    address: '45 Nguyen Hue, Hoan Kiem, Ha Noi',
    accountNumber: 'VN1000000002',
    balance: '3200000',
    pin: '123456',
  },
  {
    userId: 'USR-CUST-003',
    customerId: 'CUS-CUST-003',
    accountId: 'ACC-CUST-003',
    username: 'customer03',
    fullName: 'Le Hoang Cuong',
    email: 'customer03@bank.local',
    phone: '0901111113',
    cccd: '079204001003',
    dob: '08/11/1988',
    address: '18 Tran Phu, Hai Chau, Da Nang',
    accountNumber: 'VN1000000003',
    balance: '7800000',
    pin: '123456',
  },
];

async function upsertUser(conn, payload) {
  const existing = await conn.execute(`SELECT ID FROM USERS WHERE ID = :id`, {
    id: payload.id,
  });

  if ((existing.rows || []).length > 0) {
    await conn.execute(
      `UPDATE USERS
       SET USERNAME = :username,
           PASSWORD_HASH = :passwordHash,
           FULL_NAME = :fullName,
           EMAIL = :email,
           ROLE = :role,
           IS_ACTIVE = 1,
           ADMIN_PIN_HASH = :adminPinHash,
           FORCE_PASSWORD_CHANGE = 0,
           UPDATED_AT = SYSTIMESTAMP
       WHERE ID = :id`,
      payload,
    );
    return 'updated';
  }

  await conn.execute(
    `INSERT INTO USERS (
       ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE, IS_ACTIVE, ADMIN_PIN_HASH, FORCE_PASSWORD_CHANGE
     ) VALUES (
       :id, :username, :passwordHash, :fullName, :email, :role, 1, :adminPinHash, 0
     )`,
    payload,
  );
  return 'inserted';
}

async function upsertCustomer(conn, c, userDek) {
  const pinHash = hashSecret(c.pin, 'pin');
  const encPhone = encryptCellWithKey(userDek, c.phone);
  const encCccd = encryptCellWithKey(userDek, c.cccd);
  const encDob = encryptCellWithKey(userDek, c.dob);
  const encAddress = encryptCellWithKey(userDek, c.address);

  const existing = await conn.execute(
    `SELECT ID FROM CUSTOMERS WHERE ID = :id OR USER_ID = :userId`,
    { id: c.customerId, userId: c.userId },
  );

  if ((existing.rows || []).length > 0) {
    const customerId = existing.rows[0][0];
    await conn.execute(
      `UPDATE CUSTOMERS
       SET USER_ID = :userId,
           FULL_NAME = :fullName,
           EMAIL = :email,
           PHONE = :phone,
           CCCD = :cccd,
           DATE_OF_BIRTH = :dob,
           ADDRESS = :address,
           PIN_HASH = :pinHash,
           PIN_FAILED_ATTEMPTS = 0,
           PIN_LOCKED = 0,
           PIN_LOCKED_AT = NULL,
           UPDATED_AT = SYSTIMESTAMP
       WHERE ID = :id`,
      {
        id: customerId,
        userId: c.userId,
        fullName: c.fullName,
        email: c.email,
        phone: { val: encPhone, type: oracledb.BUFFER },
        cccd: { val: encCccd, type: oracledb.BUFFER },
        dob: { val: encDob, type: oracledb.BUFFER },
        address: { val: encAddress, type: oracledb.BUFFER },
        pinHash,
      },
    );
    return customerId;
  }

  await conn.execute(
    `INSERT INTO CUSTOMERS (
       ID, USER_ID, FULL_NAME, EMAIL, PHONE, CCCD, DATE_OF_BIRTH, ADDRESS,
       PIN_HASH, PIN_FAILED_ATTEMPTS, PIN_LOCKED, PIN_LOCKED_AT
     ) VALUES (
       :id, :userId, :fullName, :email, :phone, :cccd, :dob, :address,
       :pinHash, 0, 0, NULL
     )`,
    {
      id: c.customerId,
      userId: c.userId,
      fullName: c.fullName,
      email: c.email,
      phone: { val: encPhone, type: oracledb.BUFFER },
      cccd: { val: encCccd, type: oracledb.BUFFER },
      dob: { val: encDob, type: oracledb.BUFFER },
      address: { val: encAddress, type: oracledb.BUFFER },
      pinHash,
    },
  );
  return c.customerId;
}

async function upsertAccount(conn, c, customerId, userDek) {
  const accHash = hashAccountNumber(c.accountNumber);
  const encAccNumber = encryptCellWithKey(userDek, c.accountNumber);
  const encBalance = encryptCellWithKey(userDek, c.balance);

  const existing = await conn.execute(
    `SELECT ID FROM ACCOUNTS WHERE ID = :id OR CUSTOMER_ID = :customerId`,
    { id: c.accountId, customerId },
  );

  if ((existing.rows || []).length > 0) {
    const accountId = existing.rows[0][0];
    await conn.execute(
      `UPDATE ACCOUNTS
       SET CUSTOMER_ID = :customerId,
           ACCOUNT_NUMBER = :accountNumber,
           ACCOUNT_NUMBER_HASH = :accountNumberHash,
           ACCOUNT_TYPE = 'saving',
           BALANCE = :balance,
           IS_ACTIVE = 1
       WHERE ID = :id`,
      {
        id: accountId,
        customerId,
        accountNumber: { val: encAccNumber, type: oracledb.BUFFER },
        accountNumberHash: accHash,
        balance: { val: encBalance, type: oracledb.BUFFER },
      },
    );
    return 'updated';
  }

  await conn.execute(
    `INSERT INTO ACCOUNTS (
       ID, CUSTOMER_ID, ACCOUNT_NUMBER, ACCOUNT_NUMBER_HASH,
       ACCOUNT_TYPE, BALANCE, IS_ACTIVE
     ) VALUES (
       :id, :customerId, :accountNumber, :accountNumberHash,
       'saving', :balance, 1
     )`,
    {
      id: c.accountId,
      customerId,
      accountNumber: { val: encAccNumber, type: oracledb.BUFFER },
      accountNumberHash: accHash,
      balance: { val: encBalance, type: oracledb.BUFFER },
    },
  );
  return 'inserted';
}

async function upsertUserKeyMetadata(conn, userId, password, userDek) {
  const kdfIterations = 310000;
  const kdfSaltHex = crypto.randomBytes(16).toString('hex');
  const kek = deriveKek(password, kdfSaltHex, kdfIterations, 32);
  const wrappedDekB64 = wrapDekWithKey(kek, userDek);
  const recoveryWrappedDekB64 = recoveryKey
    ? wrapDekWithKey(recoveryKey, userDek)
    : null;

  const existing = await conn.execute(
    `SELECT USER_ID FROM USER_KEY_METADATA WHERE USER_ID = :userId`,
    { userId },
  );

  if ((existing.rows || []).length > 0) {
    await conn.execute(
      `UPDATE USER_KEY_METADATA
       SET KDF_ALGO = 'pbkdf2-sha256',
           KDF_ITERATIONS = :kdfIterations,
           KDF_SALT_HEX = :kdfSaltHex,
           WRAPPED_DEK_B64 = :wrappedDekB64,
           RECOVERY_WRAPPED_DEK_B64 = :recoveryWrappedDekB64,
           KEY_VERSION = 1,
           PASSWORD_EPOCH = 1,
           MIGRATION_STATE = 'active',
           UPDATED_AT = SYSTIMESTAMP
       WHERE USER_ID = :userId`,
      {
        userId,
        kdfIterations,
        kdfSaltHex,
        wrappedDekB64,
        recoveryWrappedDekB64,
      },
    );
    return;
  }

  await conn.execute(
    `INSERT INTO USER_KEY_METADATA (
       USER_ID, KDF_ALGO, KDF_ITERATIONS, KDF_SALT_HEX,
       WRAPPED_DEK_B64, RECOVERY_WRAPPED_DEK_B64,
       KEY_VERSION, PASSWORD_EPOCH, MIGRATION_STATE
     ) VALUES (
       :userId, 'pbkdf2-sha256', :kdfIterations, :kdfSaltHex,
       :wrappedDekB64, :recoveryWrappedDekB64,
       1, 1, 'active'
     )`,
    {
      userId,
      kdfIterations,
      kdfSaltHex,
      wrappedDekB64,
      recoveryWrappedDekB64,
    },
  );
}

async function cleanupSeedRows(conn) {
  const userIds = [
    ...admins.map((a) => a.id),
    ...customers.map((c) => c.userId),
  ];
  const requestedCustomerIds = customers.map((c) => c.customerId);
  const requestedAccountIds = customers.map((c) => c.accountId);

  const userBinds = Object.assign(
    {},
    ...userIds.map((id, i) => ({ [`u${i}`]: id })),
  );

  const existingCustomerRows = await conn.execute(
    `SELECT ID FROM CUSTOMERS WHERE USER_ID IN (${userIds.map((_, i) => `:u${i}`).join(',')})`,
    userBinds,
  );

  const discoveredCustomerIds = (existingCustomerRows.rows || []).map((r) =>
    String(r[0]),
  );
  const customerIds = Array.from(
    new Set([...requestedCustomerIds, ...discoveredCustomerIds]),
  );

  const customerBinds = Object.assign(
    {},
    ...customerIds.map((id, i) => ({ [`c${i}`]: id })),
  );

  const existingAccountRows = customerIds.length
    ? await conn.execute(
        `SELECT ID FROM ACCOUNTS WHERE CUSTOMER_ID IN (${customerIds.map((_, i) => `:c${i}`).join(',')})`,
        customerBinds,
      )
    : { rows: [] };

  const discoveredAccountIds = (existingAccountRows.rows || []).map((r) =>
    String(r[0]),
  );
  const accountIds = Array.from(
    new Set([...requestedAccountIds, ...discoveredAccountIds]),
  );

  if (accountIds.length > 0) {
    await conn.execute(
      `DELETE FROM TRANSACTIONS WHERE FROM_ACCOUNT_ID IN (${accountIds.map((_, i) => `:a${i}`).join(',')})
         OR TO_ACCOUNT_ID IN (${accountIds.map((_, i) => `:b${i}`).join(',')})`,
      Object.assign(
        {},
        ...accountIds.map((id, i) => ({ [`a${i}`]: id })),
        ...accountIds.map((id, i) => ({ [`b${i}`]: id })),
      ),
    );

    await conn.execute(
      `DELETE FROM CARDS WHERE ACCOUNT_ID IN (${accountIds.map((_, i) => `:ac${i}`).join(',')})`,
      Object.assign({}, ...accountIds.map((id, i) => ({ [`ac${i}`]: id }))),
    );

    await conn.execute(
      `DELETE FROM ACCOUNTS WHERE ID IN (${accountIds.map((_, i) => `:e${i}`).join(',')})`,
      Object.assign({}, ...accountIds.map((id, i) => ({ [`e${i}`]: id }))),
    );
  }

  if (customerIds.length > 0) {
    await conn.execute(
      `DELETE FROM CARDS WHERE CUSTOMER_ID IN (${customerIds.map((_, i) => `:d${i}`).join(',')})`,
      Object.assign({}, ...customerIds.map((id, i) => ({ [`d${i}`]: id }))),
    );

    await conn.execute(
      `DELETE FROM CUSTOMERS WHERE ID IN (${customerIds.map((_, i) => `:f${i}`).join(',')})`,
      Object.assign({}, ...customerIds.map((id, i) => ({ [`f${i}`]: id }))),
    );
  }

  await conn.execute(
    `DELETE FROM CUSTOMERS WHERE USER_ID IN (${userIds.map((_, i) => `:uu${i}`).join(',')})`,
    Object.assign({}, ...userIds.map((id, i) => ({ [`uu${i}`]: id }))),
  );

  await conn.execute(
    `DELETE FROM USER_KEY_METADATA WHERE USER_ID IN (${userIds.map((_, i) => `:g${i}`).join(',')})`,
    Object.assign({}, ...userIds.map((id, i) => ({ [`g${i}`]: id }))),
  );

  await conn.execute(
    `DELETE FROM USERS WHERE ID IN (${userIds.map((_, i) => `:h${i}`).join(',')})`,
    Object.assign({}, ...userIds.map((id, i) => ({ [`h${i}`]: id }))),
  );
}

async function tableExists(conn, tableName) {
  const result = await conn.execute(
    `SELECT COUNT(1) FROM USER_TABLES WHERE TABLE_NAME = :tableName`,
    { tableName: tableName.toUpperCase() },
  );
  return Number(result.rows?.[0]?.[0] || 0) > 0;
}

async function columnExists(conn, tableName, columnName) {
  const result = await conn.execute(
    `SELECT COUNT(1)
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = :tableName
        AND COLUMN_NAME = :columnName`,
    {
      tableName: tableName.toUpperCase(),
      columnName: columnName.toUpperCase(),
    },
  );
  return Number(result.rows?.[0]?.[0] || 0) > 0;
}

async function ensureUserKeyMetadataSchema(conn) {
  const hasTable = await tableExists(conn, 'USER_KEY_METADATA');

  if (!hasTable) {
    await conn.execute(`
      CREATE TABLE USER_KEY_METADATA (
        USER_ID VARCHAR2(36) PRIMARY KEY,
        KDF_ALGO VARCHAR2(32) DEFAULT 'pbkdf2-sha256' NOT NULL,
        KDF_ITERATIONS NUMBER(10, 0) DEFAULT 310000 NOT NULL,
        KDF_SALT_HEX VARCHAR2(128) NOT NULL,
        WRAPPED_DEK_B64 CLOB NOT NULL,
        RECOVERY_WRAPPED_DEK_B64 CLOB,
        KEY_VERSION NUMBER(10, 0) DEFAULT 1 NOT NULL,
        PASSWORD_EPOCH NUMBER(10, 0) DEFAULT 1 NOT NULL,
        MIGRATION_STATE VARCHAR2(24) DEFAULT 'legacy' NOT NULL,
        CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
        UPDATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
      )
    `);

    await conn.execute(
      `CREATE INDEX IDX_USER_KEY_METADATA_MIGRATION_STATE ON USER_KEY_METADATA (MIGRATION_STATE)`,
    );

    await conn.execute(`
      ALTER TABLE USER_KEY_METADATA
      ADD CONSTRAINT FK_UKM_USER
      FOREIGN KEY (USER_ID)
      REFERENCES USERS(ID)
    `);
    return;
  }

  if (
    !(await columnExists(conn, 'USER_KEY_METADATA', 'RECOVERY_WRAPPED_DEK_B64'))
  ) {
    await conn.execute(
      `ALTER TABLE USER_KEY_METADATA ADD (RECOVERY_WRAPPED_DEK_B64 CLOB)`,
    );
  }

  if (!(await columnExists(conn, 'USER_KEY_METADATA', 'PASSWORD_EPOCH'))) {
    await conn.execute(
      `ALTER TABLE USER_KEY_METADATA ADD (PASSWORD_EPOCH NUMBER(10, 0) DEFAULT 1 NOT NULL)`,
    );
  }
}

async function seed() {
  console.log(`Running secure seed in mode: ${runtimeMode}`);
  const conn = await oracledb.getConnection(buildConnectionOptions());

  try {
    await ensureUserKeyMetadataSchema(conn);

    if (fresh) {
      console.log('Clearing previously seeded rows...');
      await cleanupSeedRows(conn);
    }

    const defaultPassword = 'Password@123';
    for (const admin of admins) {
      const adminResult = await upsertUser(conn, {
        id: admin.id,
        username: admin.username,
        passwordHash: hashSecret(defaultPassword, 'password'),
        fullName: admin.fullName,
        email: admin.email,
        role: 'admin',
        adminPinHash: hashSecret(admin.adminPin, 'pin'),
      });
      console.log(
        `${adminResult === 'inserted' ? 'Created' : 'Updated'} admin ${admin.username}`,
      );
    }

    for (const c of customers) {
      const userResult = await upsertUser(conn, {
        id: c.userId,
        username: c.username,
        passwordHash: hashSecret(defaultPassword, 'password'),
        fullName: c.fullName,
        email: c.email,
        role: 'customer',
        adminPinHash: null,
      });

      const userDek = crypto.randomBytes(32);
      const customerId = await upsertCustomer(conn, c, userDek);
      const accountResult = await upsertAccount(conn, c, customerId, userDek);
      await upsertUserKeyMetadata(conn, c.userId, defaultPassword, userDek);

      console.log(
        `${userResult === 'inserted' ? 'Created' : 'Updated'} customer ${c.username} (${accountResult} account + key metadata)`,
      );
    }

    await conn.commit();
    console.log('Seed completed and aligned with current security schema.');
  } finally {
    await conn.close();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message || err);
  process.exit(1);
});
