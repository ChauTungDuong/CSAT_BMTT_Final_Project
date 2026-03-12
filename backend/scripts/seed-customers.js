// Chạy: node scripts/seed-customers.js
// Yêu cầu: .env đã được cấu hình, Oracle đang chạy, backend đã npm install
// Khi chạy ngoài Docker: DB_HOST tự động đổi sang localhost nếu hostname 'oracle' không dùng được

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

// Nếu DB_HOST là 'oracle' (tên Docker service), đổi thành 'localhost' khi chạy ngoài container
if (!process.env.RUNNING_IN_DOCKER && process.env.DB_HOST === 'oracle') {
  process.env.DB_HOST = 'localhost';
  console.log('ℹ️  Chạy ngoài Docker — đổi DB_HOST từ "oracle" → "localhost"');
}
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const oracledb = require('oracledb');

const masterKey = Buffer.from(process.env.AES_MASTER_KEY, 'hex');
const hmacSecret = Buffer.from(process.env.HMAC_SECRET, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  const p = ciphertext.toString('base64');
  const i = iv.toString('base64');
  const t = tag.toString('base64');
  const hmac = crypto
    .createHmac('sha256', hmacSecret)
    .update(`${p}.${i}.${t}`)
    .digest('hex');
  return Buffer.from(
    JSON.stringify({
      type: 'encrypted',
      algo: 'aes-256-gcm',
      payload: p,
      iv: i,
      tag: t,
      hmac,
    }),
  );
}

async function seed() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
  });

  const pinHash = await bcrypt.hash('123456', 12);

  const customers = [
    {
      userId: 'USR-CUST-001',
      fullName: 'Nguyễn Văn A',
      email: 'nguyenvana@gmail.com',
      phone: '0912345678',
      cccd: '079204001234',
      dob: '15/03/1990',
      address: '123 Lê Lợi, Quận 1, TP.HCM',
    },
    {
      userId: 'USR-CUST-002',
      fullName: 'Trần Thị B',
      email: 'tranthib@yahoo.com',
      phone: '0987654321',
      cccd: '001300012345',
      dob: '22/07/1995',
      address: '45 Nguyễn Huệ, Hoàn Kiếm, Hà Nội',
    },
  ];

  for (const c of customers) {
    const custId = `CUST-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

    await conn.execute(
      `INSERT INTO CUSTOMERS (ID, USER_ID, FULL_NAME, EMAIL, PHONE, CCCD, DATE_OF_BIRTH, ADDRESS, PIN_HASH)
       VALUES (:id, :userId, :fullName, :email, :phone, :cccd, :dob, :address, :pinHash)`,
      {
        id: custId,
        userId: c.userId,
        fullName: c.fullName,
        email: c.email,
        phone: { val: encrypt(c.phone), type: oracledb.BUFFER },
        cccd: { val: encrypt(c.cccd), type: oracledb.BUFFER },
        dob: { val: encrypt(c.dob), type: oracledb.BUFFER },
        address: { val: encrypt(c.address), type: oracledb.BUFFER },
        pinHash,
      },
    );

    const accNum = `VN${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    await conn.execute(
      `INSERT INTO ACCOUNTS (ID, CUSTOMER_ID, ACCOUNT_NUMBER, ACCOUNT_TYPE, BALANCE)
       VALUES (:id, :custId, :accNum, 'saving', :balance)`,
      {
        id: `ACC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
        custId,
        accNum,
        balance: {
          val: encrypt(String(Math.floor(Math.random() * 100000000 + 1000000))),
          type: oracledb.BUFFER,
        },
      },
    );
    console.log(`✅ Created customer: ${c.fullName} (account: ${accNum})`);
  }

  await conn.commit();
  await conn.close();
  console.log('🎉 Seed hoàn thành!');
}

seed().catch((err) => {
  console.error('❌ Seed thất bại:', err.message);
  process.exit(1);
});
