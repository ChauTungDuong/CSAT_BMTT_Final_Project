-- ================================================================
-- Seed data cho demo
-- Mật khẩu mặc định tất cả: Password@123
-- PIN mặc định tất cả: 123456
-- Hash được tính bằng bcrypt 12 rounds (tính sẵn)
-- ================================================================

-- 2 tài khoản Admin
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE)
VALUES (
    'USR-ADMIN-001',
    'admin1',
    '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'System Admin 1',
    EMPTY_BLOB(),
    'admin'
);

INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE)
VALUES (
    'USR-ADMIN-002',
    'admin2',
    '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'System Admin 2',
    EMPTY_BLOB(),
    'admin'
);

-- 10 tài khoản Customer
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-001', 'customer01', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Nguyen Van An', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-002', 'customer02', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Tran Thi Binh', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-003', 'customer03', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Le Hoang Cuong', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-004', 'customer04', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Pham Thi Dung', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-005', 'customer05', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Vo Minh Duc', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-006', 'customer06', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Bui Thu Ha', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-007', 'customer07', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Dang Quang Hung', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-008', 'customer08', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Nguyen Khanh Linh', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-009', 'customer09', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Do Gia Minh', EMPTY_BLOB(), 'customer'
);
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE) VALUES (
    'USR-CUST-010', 'customer10', '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii',
    'Pham Quynh Nhu', EMPTY_BLOB(), 'customer'
);

COMMIT;

-- !! Lưu ý: Dữ liệu CUSTOMERS (phone, cccd, dob, address, pin_hash) và ACCOUNTS
-- được tạo bằng Node.js để mã hóa theo AES-GCM đúng chuẩn ứng dụng.
-- Chạy: node backend/scripts/seed-customers.js sau khi backend và Oracle khởi động.

