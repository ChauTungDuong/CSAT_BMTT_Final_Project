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
      fullName: 'Nguyen Van An',
      email: 'customer01@bank.local',
      phone: '0901111111',
      cccd: '079204001001',
      dob: '15/03/1990',
      address: '123 Le Loi, Quan 1, TP.HCM',
      accountNumber: 'VN1000000001',
      balance: '1500000',
    },
    {
      userId: 'USR-CUST-002',
      fullName: 'Tran Thi Binh',
      email: 'customer02@bank.local',
      phone: '0901111112',
      cccd: '079204001002',
      dob: '22/07/1995',
      address: '45 Nguyen Hue, Hoan Kiem, Ha Noi',
      accountNumber: 'VN1000000002',
      balance: '3200000',
    },
    {
      userId: 'USR-CUST-003',
      fullName: 'Le Hoang Cuong',
      email: 'customer03@bank.local',
      phone: '0901111113',
      cccd: '079204001003',
      dob: '08/11/1988',
      address: '18 Tran Phu, Hai Chau, Da Nang',
      accountNumber: 'VN1000000003',
      balance: '7800000',
    },
    {
      userId: 'USR-CUST-004',
      fullName: 'Pham Thi Dung',
      email: 'customer04@bank.local',
      phone: '0901111114',
      cccd: '079204001004',
      dob: '01/05/1992',
      address: '77 Nguyen Thi Minh Khai, Ninh Kieu, Can Tho',
      accountNumber: 'VN1000000004',
      balance: '12500000',
    },
    {
      userId: 'USR-CUST-005',
      fullName: 'Vo Minh Duc',
      email: 'customer05@bank.local',
      phone: '0901111115',
      cccd: '079204001005',
      dob: '30/09/1993',
      address: '12 Le Hong Phong, Nha Trang, Khanh Hoa',
      accountNumber: 'VN1000000005',
      balance: '25000000',
    },
    {
      userId: 'USR-CUST-006',
      fullName: 'Bui Thu Ha',
      email: 'customer06@bank.local',
      phone: '0901111116',
      cccd: '079204001006',
      dob: '12/12/1997',
      address: '39 Nguyen Tat Thanh, Vung Tau, Ba Ria Vung Tau',
      accountNumber: 'VN1000000006',
      balance: '50300000',
    },
    {
      userId: 'USR-CUST-007',
      fullName: 'Dang Quang Hung',
      email: 'customer07@bank.local',
      phone: '0901111117',
      cccd: '079204001007',
      dob: '06/06/1987',
      address: '101 Cach Mang Thang 8, Ninh Kieu, Can Tho',
      accountNumber: 'VN1000000007',
      balance: '90000000',
    },
    {
      userId: 'USR-CUST-008',
      fullName: 'Nguyen Khanh Linh',
      email: 'customer08@bank.local',
      phone: '0901111118',
      cccd: '079204001008',
      dob: '20/01/2000',
      address: '66 3/2, Hai Chau, Da Nang',
      accountNumber: 'VN1000000008',
      balance: '125000000',
    },
    {
      userId: 'USR-CUST-009',
      fullName: 'Do Gia Minh',
      email: 'customer09@bank.local',
      phone: '0901111119',
      cccd: '079204001009',
      dob: '10/10/1991',
      address: '9 Hung Vuong, Hai Chau, Da Nang',
      accountNumber: 'VN1000000009',
      balance: '210000000',
    },
    {
      userId: 'USR-CUST-010',
      fullName: 'Pham Quynh Nhu',
      email: 'customer10@bank.local',
      phone: '0901111120',
      cccd: '079204001010',
      dob: '03/03/1998',
      address: '88 Dong Khoi, Quan 1, TP.HCM',
      accountNumber: 'VN1000000010',
      balance: '500000000',
    },
  ];

  for (const c of customers) {
    const userExists = await conn.execute(
      `SELECT ID FROM USERS WHERE ID = :userId`,
      { userId: c.userId },
    );
    if ((userExists.rows || []).length === 0) {
      console.log(`⚠️  Bỏ qua ${c.userId}: chưa có user trong USERS`);
      continue;
    }

    const existingCustomer = await conn.execute(
      `SELECT ID FROM CUSTOMERS WHERE USER_ID = :userId`,
      { userId: c.userId },
    );

    let custId;
    if ((existingCustomer.rows || []).length > 0) {
      custId = existingCustomer.rows[0][0];
      console.log(
        `ℹ️  Customer đã tồn tại cho ${c.userId}, cập nhật hồ sơ + tài khoản`,
      );

      await conn.execute(
        `UPDATE CUSTOMERS
         SET FULL_NAME = :fullName,
             EMAIL = :email,
             PHONE = :phone,
             CCCD = :cccd,
             DATE_OF_BIRTH = :dob,
             ADDRESS = :address,
             PIN_HASH = :pinHash,
             UPDATED_AT = SYSTIMESTAMP
         WHERE ID = :id`,
        {
          id: custId,
          fullName: c.fullName,
          email: c.email,
          phone: { val: encrypt(c.phone), type: oracledb.BUFFER },
          cccd: { val: encrypt(c.cccd), type: oracledb.BUFFER },
          dob: { val: encrypt(c.dob), type: oracledb.BUFFER },
          address: { val: encrypt(c.address), type: oracledb.BUFFER },
          pinHash,
        },
      );
    } else {
      custId = `CUST-${crypto.randomBytes(8).toString('hex').toUpperCase()}`;

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
    }

    const existingAccount = await conn.execute(
      `SELECT ID FROM ACCOUNTS WHERE CUSTOMER_ID = :custId`,
      { custId },
    );

    if ((existingAccount.rows || []).length > 0) {
      const accId = existingAccount.rows[0][0];
      await conn.execute(
        `UPDATE ACCOUNTS
         SET ACCOUNT_NUMBER = :accNum,
             ACCOUNT_TYPE = 'saving',
             BALANCE = :balance,
             IS_ACTIVE = 1
         WHERE ID = :id`,
        {
          id: accId,
          accNum: c.accountNumber,
          balance: { val: encrypt(c.balance), type: oracledb.BUFFER },
        },
      );
      console.log(
        `♻️  Updated customer: ${c.fullName} (account: ${c.accountNumber})`,
      );
    } else {
      await conn.execute(
        `INSERT INTO ACCOUNTS (ID, CUSTOMER_ID, ACCOUNT_NUMBER, ACCOUNT_TYPE, BALANCE)
         VALUES (:id, :custId, :accNum, 'saving', :balance)`,
        {
          id: `ACC-${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
          custId,
          accNum: c.accountNumber,
          balance: { val: encrypt(c.balance), type: oracledb.BUFFER },
        },
      );
      console.log(
        `✅ Created customer: ${c.fullName} (account: ${c.accountNumber})`,
      );
    }
  }

  await conn.commit();
  await conn.close();
  console.log('🎉 Seed hoàn thành!');
}

seed().catch((err) => {
  console.error('❌ Seed thất bại:', err.message);
  process.exit(1);
});
