-- ================================================================
-- Seed data cho demo
-- Mật khẩu mặc định tất cả: Admin@123456
-- PIN mặc định tất cả: 123456
-- Hash được tính bằng bcrypt 12 rounds (tính sẵn)
-- ================================================================

-- Tài khoản Admin
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-ADMIN-001',
    'admin',
    '$2a$12$Eh4PdZmo3UrsqwtgG2ijJ.k8CMM4M42.8TcEkY/ca5aNtdgfvLt1C',
    'admin'
);

-- Tài khoản Teller
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-TELLER-001',
    'teller01',
    '$2a$12$Eh4PdZmo3UrsqwtgG2ijJ.k8CMM4M42.8TcEkY/ca5aNtdgfvLt1C',
    'teller'
);

-- Tài khoản Customers
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-CUST-001', 'nguyenvana',
    '$2a$12$Eh4PdZmo3UrsqwtgG2ijJ.k8CMM4M42.8TcEkY/ca5aNtdgfvLt1C',
    'customer'
);

INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-CUST-002', 'tranthib',
    '$2a$12$Eh4PdZmo3UrsqwtgG2ijJ.k8CMM4M42.8TcEkY/ca5aNtdgfvLt1C',
    'customer'
);

COMMIT;

-- !! Lưu ý: Dữ liệu CUSTOMERS (phone, cccd, balance) được tạo bằng Node.js
-- Chạy: node backend/scripts/seed-customers.js sau khi backend và Oracle khởi động.
