-- MIGRATION SCRIPT FOR BANKING SECURITY ENHANCEMENTS (ORACLE SQL)
-- Safe for existing databases.

-- 1) Chuẩn hoa hash mật khẩu mặc định cho user cũ
-- Mật khẩu: Password@123
-- bcrypt(12): $2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii
UPDATE USERS
SET PASSWORD_HASH = '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii';

-- 1.1) Loại bỏ role teller trên dữ liệu cũ
UPDATE USERS
SET ROLE = 'customer'
WHERE ROLE = 'teller';

-- 1.2) Chuẩn hóa ràng buộc ROLE chỉ còn admin/customer
DECLARE
    v_exists NUMBER;
BEGIN
    FOR c IN (
        SELECT CONSTRAINT_NAME
        FROM USER_CONSTRAINTS
        WHERE TABLE_NAME = 'USERS'
          AND CONSTRAINT_TYPE = 'C'
          AND SEARCH_CONDITION_VC LIKE '%ROLE%'
          AND SEARCH_CONDITION_VC LIKE '%teller%'
    ) LOOP
        EXECUTE IMMEDIATE 'ALTER TABLE USERS DROP CONSTRAINT ' || c.CONSTRAINT_NAME;
    END LOOP;

    SELECT COUNT(*) INTO v_exists
    FROM USER_CONSTRAINTS
    WHERE TABLE_NAME = 'USERS'
      AND CONSTRAINT_NAME = 'CK_USERS_ROLE';

    IF v_exists = 0 THEN
        EXECUTE IMMEDIATE q'[ALTER TABLE USERS ADD CONSTRAINT CK_USERS_ROLE CHECK (ROLE IN ('customer', 'admin'))]';
    END IF;
END;
/

-- 1.3) Seed/chuẩn hóa USERS: 2 admin + 10 customer (idempotent)
DECLARE
    v_hash VARCHAR2(255) := '$2a$12$pA3TOCgurZaQ4To9U40PSesxDpM2IS2eDlu9cVRUZGjc7FJI1Hlii';

    PROCEDURE upsert_user(
        p_id VARCHAR2,
        p_username VARCHAR2,
        p_full_name VARCHAR2,
        p_email VARCHAR2,
        p_role VARCHAR2
    ) IS
    BEGIN
        MERGE INTO USERS u
        USING (
            SELECT p_id id,
                   p_username username,
                   p_full_name full_name,
                   p_email email,
                   p_role role
            FROM dual
        ) s
        ON (u.ID = s.id)
        WHEN MATCHED THEN UPDATE SET
            u.USERNAME = s.username,
            u.PASSWORD_HASH = v_hash,
            u.FULL_NAME = s.full_name,
            u.EMAIL = s.email,
            u.ROLE = s.role,
            u.IS_ACTIVE = 1,
            u.UPDATED_AT = SYSTIMESTAMP
        WHEN NOT MATCHED THEN
            INSERT (ID, USERNAME, PASSWORD_HASH, FULL_NAME, EMAIL, ROLE, IS_ACTIVE, CREATED_AT, UPDATED_AT)
            VALUES (s.id, s.username, v_hash, s.full_name, s.email, s.role, 1, SYSTIMESTAMP, SYSTIMESTAMP);
    END;
BEGIN
    upsert_user('USR-ADMIN-001', 'admin1', 'System Admin 1', 'admin1@bank.local', 'admin');
    upsert_user('USR-ADMIN-002', 'admin2', 'System Admin 2', 'admin2@bank.local', 'admin');

    upsert_user('USR-CUST-001', 'customer01', 'Nguyen Van An', 'customer01@bank.local', 'customer');
    upsert_user('USR-CUST-002', 'customer02', 'Tran Thi Binh', 'customer02@bank.local', 'customer');
    upsert_user('USR-CUST-003', 'customer03', 'Le Hoang Cuong', 'customer03@bank.local', 'customer');
    upsert_user('USR-CUST-004', 'customer04', 'Pham Thi Dung', 'customer04@bank.local', 'customer');
    upsert_user('USR-CUST-005', 'customer05', 'Vo Minh Duc', 'customer05@bank.local', 'customer');
    upsert_user('USR-CUST-006', 'customer06', 'Bui Thu Ha', 'customer06@bank.local', 'customer');
    upsert_user('USR-CUST-007', 'customer07', 'Dang Quang Hung', 'customer07@bank.local', 'customer');
    upsert_user('USR-CUST-008', 'customer08', 'Nguyen Khanh Linh', 'customer08@bank.local', 'customer');
    upsert_user('USR-CUST-009', 'customer09', 'Do Gia Minh', 'customer09@bank.local', 'customer');
    upsert_user('USR-CUST-010', 'customer10', 'Pham Quynh Nhu', 'customer10@bank.local', 'customer');
END;
/

-- 2) Tạo bảng CARDS nếu chưa có
DECLARE
    v_table_count NUMBER;
    v_index_count NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_table_count
    FROM USER_TABLES
    WHERE TABLE_NAME = 'CARDS';

    IF v_table_count = 0 THEN
        EXECUTE IMMEDIATE '
            CREATE TABLE CARDS (
                ID              VARCHAR2(36)  DEFAULT SYS_GUID() PRIMARY KEY,
                CUSTOMER_ID     VARCHAR2(36)  NOT NULL,
                ACCOUNT_ID      VARCHAR2(36),
                CARD_NUMBER     BLOB          NOT NULL,
                CVV             BLOB          NOT NULL,
                CARD_EXPIRY     BLOB          NOT NULL,
                IS_ACTIVE       NUMBER(1)     DEFAULT 1,
                CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
                CONSTRAINT FK_CARDS_CUSTOMER FOREIGN KEY (CUSTOMER_ID) REFERENCES CUSTOMERS(ID)
            )';
    END IF;

    SELECT COUNT(*) INTO v_index_count
    FROM USER_INDEXES
    WHERE INDEX_NAME = 'IDX_CARDS_CUSTOMER';

    IF v_index_count = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_CARDS_CUSTOMER ON CARDS(CUSTOMER_ID)';
    END IF;
END;
/

COMMIT;
