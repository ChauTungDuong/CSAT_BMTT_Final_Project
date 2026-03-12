-- ================================================================
-- SECURE BANK APP — Oracle XE Schema
-- Chú ý: Tên bảng/cột dùng UPPERCASE (Oracle convention)
-- ================================================================

-- ── Bảng người dùng hệ thống ────────────────────────────────────
CREATE TABLE USERS (
    ID              VARCHAR2(36)  DEFAULT SYS_GUID() PRIMARY KEY,
    USERNAME        VARCHAR2(100) NOT NULL UNIQUE,
    PASSWORD_HASH   VARCHAR2(255) NOT NULL,
    FULL_NAME       VARCHAR2(200),
    EMAIL           VARCHAR2(200),
    ROLE            VARCHAR2(20)  DEFAULT 'customer'
                    CHECK (ROLE IN ('customer', 'teller', 'admin')),
    IS_ACTIVE       NUMBER(1)     DEFAULT 1,
    CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    UPDATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP
);

-- ── Bảng thông tin khách hàng (dữ liệu nhạy cảm → encrypted) ───
CREATE TABLE CUSTOMERS (
    ID              VARCHAR2(36)  DEFAULT SYS_GUID() PRIMARY KEY,
    USER_ID         VARCHAR2(36)  NOT NULL UNIQUE,
    FULL_NAME       VARCHAR2(200) NOT NULL,
    EMAIL           VARCHAR2(200) NOT NULL,
    PHONE           BLOB,
    CCCD            BLOB,
    DATE_OF_BIRTH   BLOB,
    ADDRESS         BLOB,
    PIN_HASH        VARCHAR2(255),
    CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    UPDATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    CONSTRAINT FK_CUSTOMERS_USER FOREIGN KEY (USER_ID) REFERENCES USERS(ID)
);

-- ── Bảng tài khoản ngân hàng ────────────────────────────────────
CREATE TABLE ACCOUNTS (
    ID              VARCHAR2(36)  DEFAULT SYS_GUID() PRIMARY KEY,
    CUSTOMER_ID     VARCHAR2(36)  NOT NULL,
    ACCOUNT_NUMBER  VARCHAR2(20)  NOT NULL UNIQUE,
    ACCOUNT_TYPE    VARCHAR2(20)  DEFAULT 'saving'
                    CHECK (ACCOUNT_TYPE IN ('saving', 'checking', 'credit')),
    BALANCE         BLOB          NOT NULL,
    CARD_NUMBER     BLOB,
    CVV             BLOB,
    CARD_EXPIRY     BLOB,
    IS_ACTIVE       NUMBER(1)     DEFAULT 1,
    CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    CONSTRAINT FK_ACCOUNTS_CUSTOMER FOREIGN KEY (CUSTOMER_ID) REFERENCES CUSTOMERS(ID)
);

-- ── Bảng giao dịch ──────────────────────────────────────────────
CREATE TABLE TRANSACTIONS (
    ID                  VARCHAR2(36)    DEFAULT SYS_GUID() PRIMARY KEY,
    FROM_ACCOUNT_ID     VARCHAR2(36),
    TO_ACCOUNT_ID       VARCHAR2(36),
    AMOUNT              BLOB            NOT NULL,
    TRANSACTION_TYPE    VARCHAR2(30)    NOT NULL
                        CHECK (TRANSACTION_TYPE IN ('transfer', 'deposit', 'withdrawal', 'payment')),
    STATUS              VARCHAR2(20)    DEFAULT 'completed'
                        CHECK (STATUS IN ('pending', 'completed', 'failed', 'reversed')),
    DESCRIPTION         VARCHAR2(500),
    REFERENCE_CODE      VARCHAR2(50)    UNIQUE,
    CREATED_AT          TIMESTAMP       DEFAULT SYSTIMESTAMP,
    CONSTRAINT FK_TRANS_FROM FOREIGN KEY (FROM_ACCOUNT_ID) REFERENCES ACCOUNTS(ID),
    CONSTRAINT FK_TRANS_TO   FOREIGN KEY (TO_ACCOUNT_ID)   REFERENCES ACCOUNTS(ID)
);

-- ── Bảng audit log ──────────────────────────────────────────────
CREATE TABLE AUDIT_LOGS (
    ID              NUMBER          GENERATED AS IDENTITY PRIMARY KEY,
    EVENT_TYPE      VARCHAR2(50)    NOT NULL,
    USER_ID         VARCHAR2(36),
    TARGET_ID       VARCHAR2(36),
    IP_ADDRESS      VARCHAR2(50),
    USER_AGENT      VARCHAR2(500),
    DETAIL          VARCHAR2(1000),
    CREATED_AT      TIMESTAMP       DEFAULT SYSTIMESTAMP
);

-- ── Indexes ──────────────────────────────────────────────────────
CREATE INDEX IDX_CUSTOMERS_USER_ID   ON CUSTOMERS(USER_ID);
CREATE INDEX IDX_ACCOUNTS_CUSTOMER   ON ACCOUNTS(CUSTOMER_ID);
CREATE INDEX IDX_ACCOUNTS_NUMBER     ON ACCOUNTS(ACCOUNT_NUMBER);
CREATE INDEX IDX_TRANSACTIONS_FROM   ON TRANSACTIONS(FROM_ACCOUNT_ID);
CREATE INDEX IDX_TRANSACTIONS_TO     ON TRANSACTIONS(TO_ACCOUNT_ID);
CREATE INDEX IDX_AUDIT_USER_ID       ON AUDIT_LOGS(USER_ID);
CREATE INDEX IDX_AUDIT_CREATED       ON AUDIT_LOGS(CREATED_AT);
