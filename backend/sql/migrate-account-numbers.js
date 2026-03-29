/**
 * Migration script: Encrypt all account numbers in database
 * Usage: node sql/migrate-account-numbers.js
 *
 * Steps:
 * 1. Fetch all accounts with legacy plaintext account numbers
 * 2. For each account:
 *    - Encrypt account number with AES-256-GCM
 *    - Compute HMAC-SHA256 hash
 *    - Update ACCOUNT_NUMBER (encrypted) and ACCOUNT_NUMBER_HASH
 * 3. Log migration status
 */

const crypto = require('crypto');
const oracledb = require('oracledb');

// Load environment
require('dotenv').config({ path: '.env' });

const AES_MASTER_KEY = process.env.AES_MASTER_KEY;

if (!AES_MASTER_KEY || AES_MASTER_KEY.length !== 64) {
  console.error('❌ AES_MASTER_KEY must be 64 hex characters (32 bytes)');
  process.exit(1);
}

const masterKey = Buffer.from(AES_MASTER_KEY, 'hex');

/**
 * Encrypt account number using AES-256-GCM (matching backend)
 */
function encryptAccountNumber(plaintext) {
  const iv = crypto.randomBytes(12); // 12 bytes for GCM
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const encrypted = cipher.update(plaintext, 'utf8');
  const final = cipher.final();
  const authTag = cipher.getAuthTag();

  // Return as single buffer: IV + encrypted + authTag (format: base64)
  // Actually, match the backend format: {algo, payload: base64, iv: base64, tag: base64}
  const payload = {
    algo: 'aes-256-gcm',
    payload: Buffer.concat([encrypted, final]).toString('base64'),
    iv: iv.toString('base64'),
    tag: authTag.toString('base64'),
  };

  // Serialize to JSON and return as buffer (matching backend.serialize())
  return Buffer.from(JSON.stringify(payload), 'utf8');
}

/**
 * Compute HMAC-SHA256 hash  of plaintext account number (for lookups)
 */
function hashAccountNumber(plaintext) {
  const normalized = plaintext.trim();
  return crypto
    .createHmac('sha256', masterKey)
    .update(normalized)
    .digest('hex');
}

/**
 * Main migration logic
 */
async function migrate() {
  const connection = await oracledb.getConnection({
    user: process.env.ORACLE_USER || 'csat',
    password: process.env.ORACLE_PASSWORD || 'Pass1234',
    connectString: process.env.ORACLE_CONNECT_STRING || 'localhost:1521/xepdb1',
  });

  try {
    console.log('🔄 Starting account number encryption migration...\n');

    // Fetch all accounts with legacy plaintext numbers
    const result = await connection.execute(
      `SELECT ID, ACCOUNT_NUMBER_LEGACY 
       FROM ACCOUNTS 
       WHERE ACCOUNT_NUMBER_LEGACY IS NOT NULL 
       ORDER BY CREATED_AT`,
    );

    const rows = result.rows || [];
    console.log(`📊 Found ${rows.length} accounts to migrate\n`);

    if (rows.length === 0) {
      console.log('✅ No accounts to migrate');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const [id, plainAccountNumber] of rows) {
      try {
        const encrypted = encryptAccountNumber(plainAccountNumber);
        const hash = hashAccountNumber(plainAccountNumber);

        // Update account with encrypted number and hash
        await connection.execute(
          `UPDATE ACCOUNTS 
           SET ACCOUNT_NUMBER = :encrypted, ACCOUNT_NUMBER_HASH = :hash 
           WHERE ID = :id`,
          {
            encrypted,
            hash,
            id,
          },
        );

        successCount++;
        console.log(
          `✅ Migrated account ${id}: ${plainAccountNumber} → hash: ${hash.substring(0, 8)}...`,
        );
      } catch (err) {
        failCount++;
        console.error(
          `❌ Failed to migrate account ${id} (${plainAccountNumber}):`,
          err.message,
        );
      }
    }

    // Commit all changes
    await connection.commit();

    console.log(`\n📈 Migration summary:`);
    console.log(`  ✅ Success: ${successCount}`);
    console.log(`  ❌ Failed: ${failCount}`);
    console.log(`  📊 Total: ${rows.length}`);

    if (failCount === 0) {
      console.log('\n🎉 Migration completed successfully!');
      console.log(
        'Next step: ALTER TABLE ACCOUNTS DROP COLUMN ACCOUNT_NUMBER_LEGACY;',
      );
    } else {
      console.log('\n⚠️  Some accounts failed - review errors above');
    }
  } catch (err) {
    await connection.rollback();
    console.error('❌ Migration failed:', err);
    process.exit(1);
  } finally {
    await connection.close();
  }
}

migrate().catch(console.error);
