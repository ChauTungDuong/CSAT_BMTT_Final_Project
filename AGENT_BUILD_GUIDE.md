# Hướng Dẫn Xây Dựng Ứng Dụng Ngân Hàng Mô Phỏng
## Dành cho AI Agent — Build từ đầu đến cuối

> **Mục đích**: Tài liệu này mô tả đầy đủ yêu cầu, kiến trúc, và từng bước triển khai ứng dụng ngân hàng mô phỏng phục vụ bài tập môn **Cơ sở An toàn & Bảo mật Thông tin**.  
> **Trọng tâm**: Bảo mật — mã hoá AES-256-GCM, băm bcrypt, mặt nạ dữ liệu (data masking), xác thực PIN 6 số.  
> **Stack**: NestJS · TypeScript · Oracle XE 21c · React · Docker

---

## Mục Lục

1. [Tổng Quan Hệ Thống](#1-tổng-quan-hệ-thống)
2. [Yêu Cầu Môi Trường](#2-yêu-cầu-môi-trường)
3. [Cấu Trúc Thư Mục](#3-cấu-trúc-thư-mục)
4. [Docker & Database Setup](#4-docker--database-setup)
5. [Database Schema Oracle](#5-database-schema-oracle)
6. [Backend — NestJS](#6-backend--nestjs)
7. [Frontend — React](#7-frontend--react)
8. [Biến Môi Trường](#8-biến-môi-trường)
9. [Vai Trò & Quy Tắc Masking](#9-vai-trò--quy-tắc-masking)
10. [Luồng Bảo Mật Chi Tiết](#10-luồng-bảo-mật-chi-tiết)
11. [API Endpoints](#11-api-endpoints)
12. [Hướng Dẫn Chạy](#12-hướng-dẫn-chạy)
13. [Seed Data](#13-seed-data)
14. [Checklist Kiểm Thử](#14-checklist-kiểm-thử)

---

## 1. Tổng Quan Hệ Thống

### 1.1 Mô tả

Ứng dụng web mô phỏng hệ thống ngân hàng cơ bản với 3 lớp bảo mật:

| Lớp | Cơ chế | Mục đích |
|-----|--------|----------|
| Lưu trữ | AES-256-GCM | Dữ liệu nhạy cảm trong Oracle là ciphertext |
| Xác thực | bcrypt (12 rounds) | Mật khẩu đăng nhập không thể reverse |
| Hiển thị | Data Masking | Mỗi role chỉ thấy đúng phần cần thiết |
| Truyền tải | HTTPS/TLS | Dữ liệu trên kênh công khai được mã hoá |

### 1.2 Ba Vai Trò (Roles)

```
CUSTOMER (Khách hàng)
  → Xem thông tin của chính mình (partial mask mặc định)
  → Nhập PIN 6 số → xem toàn bộ thông tin không che
  → Thực hiện chuyển khoản, xem lịch sử giao dịch

TELLER (Nhân viên giao dịch)
  → Tra cứu thông tin khách hàng (partial mask nghiệp vụ)
  → Hỗ trợ khách hàng: xem SĐT partial, ẩn CCCD/số thẻ
  → Không thể xem full info dù có PIN (PIN chỉ dành cho customer)

ADMIN (Quản trị hệ thống)
  → Quản lý tài khoản, phân quyền
  → Xem log hệ thống (dữ liệu khách hàng đã mask)
  → Không thể xem dữ liệu tài chính của khách hàng
```

### 1.3 Nguyên Tắc Thiết Kế Bảo Mật

- **Need-to-know**: Mỗi role chỉ thấy đúng những gì cần để làm việc
- **Encryption at rest**: Mọi dữ liệu nhạy cảm → ciphertext trong Oracle
- **No plaintext in logs**: Audit log không bao giờ chứa plaintext nhạy cảm
- **PIN ≠ Password**: PIN 6 số hash riêng bằng bcrypt, hoàn toàn tách biệt với mật khẩu đăng nhập
- **IV random**: Mỗi lần encrypt dùng IV mới → cùng plaintext → ciphertext khác nhau

---

## 2. Yêu Cầu Môi Trường

### 2.1 Phần mềm cần cài

```bash
# Kiểm tra các tool đã có
node --version          # >= 18.x LTS
npm --version           # >= 9.x
docker --version        # >= 24.x
docker compose version  # >= 2.x
```

### 2.2 Cài đặt nếu chưa có

```bash
# Node.js (dùng nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18

# NestJS CLI
npm install -g @nestjs/cli

# Docker Desktop: https://www.docker.com/products/docker-desktop/
```

---

## 3. Cấu Trúc Thư Mục

```
secure-bank-app/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.config.ts
│   │   │   └── env.validation.ts
│   │   ├── crypto/
│   │   │   ├── interfaces/
│   │   │   │   └── crypto.interface.ts
│   │   │   ├── services/
│   │   │   │   ├── aes.service.ts
│   │   │   │   └── hmac.service.ts
│   │   │   └── crypto.module.ts
│   │   ├── masking/
│   │   │   ├── masking.engine.ts
│   │   │   ├── masking.rules.ts
│   │   │   └── masking.module.ts
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── dto/
│   │   │   │   │   ├── login.dto.ts
│   │   │   │   │   └── register.dto.ts
│   │   │   │   ├── guards/
│   │   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   │   └── roles.guard.ts
│   │   │   │   ├── strategies/
│   │   │   │   │   └── jwt.strategy.ts
│   │   │   │   ├── decorators/
│   │   │   │   │   └── roles.decorator.ts
│   │   │   │   ├── auth.controller.ts
│   │   │   │   ├── auth.service.ts
│   │   │   │   └── auth.module.ts
│   │   │   ├── customers/
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-customer.dto.ts
│   │   │   │   │   ├── update-customer.dto.ts
│   │   │   │   │   └── verify-pin.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── customer.entity.ts
│   │   │   │   ├── customers.controller.ts
│   │   │   │   ├── customers.service.ts
│   │   │   │   └── customers.module.ts
│   │   │   ├── accounts/
│   │   │   │   ├── entities/
│   │   │   │   │   └── account.entity.ts
│   │   │   │   ├── accounts.controller.ts
│   │   │   │   ├── accounts.service.ts
│   │   │   │   └── accounts.module.ts
│   │   │   ├── transactions/
│   │   │   │   ├── dto/
│   │   │   │   │   └── transfer.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── transaction.entity.ts
│   │   │   │   ├── transactions.controller.ts
│   │   │   │   ├── transactions.service.ts
│   │   │   │   └── transactions.module.ts
│   │   │   ├── teller/
│   │   │   │   ├── teller.controller.ts
│   │   │   │   ├── teller.service.ts
│   │   │   │   └── teller.module.ts
│   │   │   └── admin/
│   │   │       ├── admin.controller.ts
│   │   │       ├── admin.service.ts
│   │   │       └── admin.module.ts
│   │   ├── audit/
│   │   │   ├── entities/
│   │   │   │   └── audit-log.entity.ts
│   │   │   ├── audit.service.ts
│   │   │   └── audit.module.ts
│   │   ├── common/
│   │   │   ├── decorators/
│   │   │   │   └── roles.decorator.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   └── roles.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   └── audit.interceptor.ts
│   │   │   └── types/
│   │   │       └── role.enum.ts
│   │   └── app.module.ts
│   ├── sql/
│   │   ├── 01_schema.sql
│   │   ├── 02_seed.sql
│   │   └── 03_redact.sql
│   ├── ssl/
│   │   ├── cert.pem
│   │   └── key.pem
│   ├── .env
│   ├── .env.example
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── MaskedField.tsx
│   │   │   │   ├── PinModal.tsx
│   │   │   │   ├── Navbar.tsx
│   │   │   │   └── LoadingSpinner.tsx
│   │   │   ├── customer/
│   │   │   │   ├── ProfileCard.tsx
│   │   │   │   ├── AccountSummary.tsx
│   │   │   │   └── TransactionList.tsx
│   │   │   ├── teller/
│   │   │   │   └── CustomerSearch.tsx
│   │   │   └── admin/
│   │   │       ├── UserTable.tsx
│   │   │       └── AuditLogTable.tsx
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RegisterPage.tsx
│   │   │   ├── customer/
│   │   │   │   ├── DashboardPage.tsx
│   │   │   │   ├── ProfilePage.tsx
│   │   │   │   └── TransferPage.tsx
│   │   │   ├── teller/
│   │   │   │   └── TellerPage.tsx
│   │   │   └── admin/
│   │   │       ├── AdminDashboard.tsx
│   │   │       └── AuditPage.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx
│   │   ├── hooks/
│   │   │   └── usePin.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
└── README.md
```

---

## 4. Docker & Database Setup

### 4.1 `docker-compose.yml` (root)

```yaml
version: '3.8'

services:
  oracle:
    image: gvenzl/oracle-xe:21-slim
    container_name: oracle-xe
    restart: unless-stopped
    ports:
      - "1521:1521"
      - "5500:5500"
    environment:
      ORACLE_PASSWORD: ${DB_ROOT_PASSWORD}
      APP_USER: ${DB_USER}
      APP_USER_PASSWORD: ${DB_PASSWORD}
    volumes:
      - oracle_data:/opt/oracle/oradata
      - ./backend/sql/01_schema.sql:/container-entrypoint-initdb.d/01_schema.sql
      - ./backend/sql/02_seed.sql:/container-entrypoint-initdb.d/02_seed.sql
    healthcheck:
      test: ["CMD", "healthcheck.sh"]
      interval: 30s
      timeout: 10s
      retries: 15
      start_period: 120s

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: bank-backend
    restart: unless-stopped
    ports:
      - "3000:3000"
    depends_on:
      oracle:
        condition: service_healthy
    env_file:
      - ./backend/.env
    volumes:
      - ./backend/ssl:/app/ssl:ro

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    container_name: bank-frontend
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    depends_on:
      - backend
    volumes:
      - ./backend/ssl:/etc/nginx/ssl:ro

volumes:
  oracle_data:
```

### 4.2 `backend/Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Cài Oracle Instant Client (cần cho oracledb)
RUN apk add --no-cache libaio libnsl libc6-compat curl && \
    cd /tmp && \
    curl -o instantclient.zip \
      https://download.oracle.com/otn_software/linux/instantclient/instantclient-basiclite-linuxx64.zip || true

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# Production stage
FROM node:18-alpine AS production

RUN apk add --no-cache libaio libnsl libc6-compat

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

> **Lưu ý**: Nếu gặp lỗi Oracle Instant Client trong Alpine, dùng image `node:18-slim` (Debian) thay thế và cài `libaio1` qua apt.

### 4.3 `frontend/Dockerfile`

```dockerfile
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production

# Copy built app
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80 443

CMD ["nginx", "-g", "daemon off;"]
```

### 4.4 `frontend/nginx.conf`

```nginx
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name _;

    ssl_certificate     /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    root /usr/share/nginx/html;
    index index.html;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass         http://bank-backend:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.5 Tạo Self-Signed SSL Certificate

```bash
mkdir -p backend/ssl

openssl req -x509 -newkey rsa:4096 \
  -keyout backend/ssl/key.pem \
  -out backend/ssl/cert.pem \
  -days 365 -nodes \
  -subj "/C=VN/ST=Hanoi/L=Hanoi/O=BankDemo/CN=localhost"
```

---

## 5. Database Schema Oracle

### 5.1 `backend/sql/01_schema.sql`

```sql
-- ================================================================
-- SECURE BANK APP — Oracle XE Schema
-- Chú ý: Tên bảng/cột dùng UPPERCASE (Oracle convention)
-- ================================================================

-- ── Bảng người dùng hệ thống ────────────────────────────────────
CREATE TABLE USERS (
    ID              VARCHAR2(36)  DEFAULT SYS_GUID() PRIMARY KEY,
    USERNAME        VARCHAR2(100) NOT NULL UNIQUE,
    PASSWORD_HASH   VARCHAR2(255) NOT NULL,  -- bcrypt hash đăng nhập
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
    FULL_NAME       VARCHAR2(200) NOT NULL,     -- Plaintext: dùng để định danh
    EMAIL           VARCHAR2(200) NOT NULL,     -- Plaintext: dùng để liên lạc
    PHONE           BLOB,                       -- AES-256-GCM encrypted
    CCCD            BLOB,                       -- AES-256-GCM encrypted
    DATE_OF_BIRTH   BLOB,                       -- AES-256-GCM encrypted
    ADDRESS         BLOB,                       -- AES-256-GCM encrypted
    PIN_HASH        VARCHAR2(255),              -- bcrypt hash của PIN 6 số (TÁCH BIỆT password)
    CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    UPDATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    CONSTRAINT FK_CUSTOMERS_USER FOREIGN KEY (USER_ID) REFERENCES USERS(ID)
);

-- ── Bảng tài khoản ngân hàng ────────────────────────────────────
CREATE TABLE ACCOUNTS (
    ID              VARCHAR2(36)  DEFAULT SYS_GUID() PRIMARY KEY,
    CUSTOMER_ID     VARCHAR2(36)  NOT NULL,
    ACCOUNT_NUMBER  VARCHAR2(20)  NOT NULL UNIQUE,  -- Plaintext số TK (cần để giao dịch)
    ACCOUNT_TYPE    VARCHAR2(20)  DEFAULT 'saving'
                    CHECK (ACCOUNT_TYPE IN ('saving', 'checking', 'credit')),
    BALANCE         BLOB          NOT NULL,          -- AES-256-GCM encrypted
    CARD_NUMBER     BLOB,                            -- AES-256-GCM encrypted
    CVV             BLOB,                            -- AES-256-GCM encrypted
    CARD_EXPIRY     BLOB,                            -- AES-256-GCM encrypted
    IS_ACTIVE       NUMBER(1)     DEFAULT 1,
    CREATED_AT      TIMESTAMP     DEFAULT SYSTIMESTAMP,
    CONSTRAINT FK_ACCOUNTS_CUSTOMER FOREIGN KEY (CUSTOMER_ID) REFERENCES CUSTOMERS(ID)
);

-- ── Bảng giao dịch ──────────────────────────────────────────────
CREATE TABLE TRANSACTIONS (
    ID                  VARCHAR2(36)    DEFAULT SYS_GUID() PRIMARY KEY,
    FROM_ACCOUNT_ID     VARCHAR2(36),
    TO_ACCOUNT_ID       VARCHAR2(36),
    AMOUNT              BLOB            NOT NULL,   -- AES-256-GCM encrypted
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
    -- Ví dụ: LOGIN_SUCCESS, LOGIN_FAIL, VIEW_PROFILE, PIN_VERIFY,
    --        TRANSFER, ADMIN_VIEW_USER, TELLER_LOOKUP
    USER_ID         VARCHAR2(36),
    TARGET_ID       VARCHAR2(36),   -- ID của đối tượng bị tác động
    IP_ADDRESS      VARCHAR2(50),
    USER_AGENT      VARCHAR2(500),
    DETAIL          VARCHAR2(1000), -- KHÔNG chứa plaintext nhạy cảm
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
```

### 5.2 `backend/sql/03_redact.sql` — Oracle DBMS_REDACT (chạy với SYSTEM)

```sql
-- Kết nối: sqlplus system/<password>@//localhost/XEPDB1
-- DBMS_REDACT thêm lớp mask tại tầng DB (độc lập với app layer)

-- Tạo bảng demo plaintext để minh hoạ DBMS_REDACT
-- (trong production, bảng thực chứa ciphertext nên Redact không cần thiết)
-- Dùng cho mục đích trình diễn trong báo cáo

GRANT EXECUTE ON DBMS_REDACT TO SMASK_USER;

-- Ví dụ: nếu có bảng CUSTOMERS_DEMO với cột PHONE_PLAIN
BEGIN
    DBMS_REDACT.ADD_POLICY(
        object_schema       => 'SMASK_USER',
        object_name         => 'CUSTOMERS',
        column_name         => 'EMAIL',
        policy_name         => 'redact_email_teller',
        function_type       => DBMS_REDACT.PARTIAL,
        -- Giữ 2 ký tự đầu, mask giữa, giữ phần domain
        function_parameters => 'VVVFVVVVVVVVVVVVVVVVV,VV,*,3,LENGTH(EMAIL)-LENGTH(REGEXP_SUBSTR(EMAIL,''@.*''))',
        -- Chỉ áp dụng cho teller role (minh hoạ)
        expression          => 'SYS_CONTEXT(''USERENV'',''SESSION_USER'') = ''SMASK_USER'''
    );
END;
/
```

---

## 6. Backend — NestJS

### 6.1 Khởi Tạo Project

```bash
cd secure-bank-app
nest new backend --strict
cd backend

# Cài tất cả dependencies
npm install \
  @nestjs/typeorm typeorm oracledb \
  @nestjs/config \
  @nestjs/jwt @nestjs/passport passport passport-jwt \
  bcryptjs \
  class-validator class-transformer \
  @nestjs/throttler \
  helmet \
  cookie-parser

npm install -D \
  @types/oracledb \
  @types/bcryptjs \
  @types/passport-jwt \
  @types/cookie-parser
```

### 6.2 `backend/tsconfig.json`

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "declaration": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "target": "ES2021",
    "sourceMap": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "incremental": true,
    "skipLibCheck": true,
    "strictNullChecks": true,
    "noImplicitAny": true,
    "strictBindCallApply": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

### 6.3 `src/common/types/role.enum.ts`

```typescript
export enum Role {
  CUSTOMER = 'customer',
  TELLER = 'teller',
  ADMIN = 'admin',
}

export type ViewerRole = Role | 'self'; // 'self' = chính chủ đã xác thực PIN
```

### 6.4 `src/crypto/interfaces/crypto.interface.ts`

```typescript
// CellValue: cấu trúc lưu mỗi trường đã mã hoá trong Oracle BLOB
export interface ClearCell {
  type: 'clear';
  data: string;
}

export interface EncryptedCell {
  type: 'encrypted';
  algo: 'aes-256-gcm';
  payload: string;   // base64 ciphertext
  iv: string;        // base64 12-byte IV (ngẫu nhiên mỗi lần encrypt)
  tag: string;       // base64 16-byte GCM auth tag
  hmac: string;      // HMAC-SHA256 hex để verify toàn vẹn
}

export type CellValue = ClearCell | EncryptedCell;

export interface ICryptoService {
  encrypt(plaintext: string): Promise<CellValue>;
  decrypt(cell: CellValue): Promise<string | null>;
  serialize(cell: CellValue): Buffer;
  deserialize(data: Buffer): CellValue;
}
```

### 6.5 `src/crypto/services/aes.service.ts`

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { CellValue, EncryptedCell, ICryptoService } from '../interfaces/crypto.interface';

@Injectable()
export class AesService implements ICryptoService {
  private readonly logger = new Logger(AesService.name);
  private readonly masterKey: Buffer;
  private readonly hmacSecret: Buffer;

  constructor(private readonly config: ConfigService) {
    const keyHex = config.getOrThrow<string>('AES_MASTER_KEY');
    const hmacHex = config.getOrThrow<string>('HMAC_SECRET');

    if (keyHex.length !== 64) throw new Error('AES_MASTER_KEY phải là 64 hex chars (32 bytes)');
    if (hmacHex.length !== 64) throw new Error('HMAC_SECRET phải là 64 hex chars (32 bytes)');

    this.masterKey = Buffer.from(keyHex, 'hex');
    this.hmacSecret = Buffer.from(hmacHex, 'hex');
  }

  async encrypt(plaintext: string): Promise<CellValue> {
    // IV ngẫu nhiên mỗi lần — BẮT BUỘC
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag(); // 16 bytes authentication tag

    const payloadB64 = ciphertext.toString('base64');
    const ivB64 = iv.toString('base64');
    const tagB64 = tag.toString('base64');

    // HMAC trên toàn bộ ciphertext + IV + tag để detect tampering
    const hmac = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(`${payloadB64}.${ivB64}.${tagB64}`)
      .digest('hex');

    return {
      type: 'encrypted',
      algo: 'aes-256-gcm',
      payload: payloadB64,
      iv: ivB64,
      tag: tagB64,
      hmac,
    } as EncryptedCell;
  }

  async decrypt(cell: CellValue): Promise<string | null> {
    if (cell.type === 'clear') return cell.data;

    const enc = cell as EncryptedCell;

    // 1. Verify HMAC trước khi decrypt
    const expectedHmac = crypto
      .createHmac('sha256', this.hmacSecret)
      .update(`${enc.payload}.${enc.iv}.${enc.tag}`)
      .digest('hex');

    if (expectedHmac !== enc.hmac) {
      this.logger.error('HMAC mismatch — dữ liệu có thể bị giả mạo');
      return null; // KHÔNG throw để tránh timing attack
    }

    // 2. Decrypt
    try {
      const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        this.masterKey,
        Buffer.from(enc.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(enc.tag, 'base64'));

      return Buffer.concat([
        decipher.update(Buffer.from(enc.payload, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      this.logger.error('AES-GCM decrypt thất bại — auth tag không khớp');
      return null;
    }
  }

  serialize(cell: CellValue): Buffer {
    return Buffer.from(JSON.stringify(cell), 'utf8');
  }

  deserialize(data: Buffer | null): CellValue {
    if (!data) return { type: 'clear', data: '' };
    try {
      // Oracle trả về LOB object hoặc Buffer
      const str = Buffer.isBuffer(data)
        ? data.toString('utf8')
        : String(data);
      return JSON.parse(str) as CellValue;
    } catch {
      return { type: 'clear', data: '' };
    }
  }

  // Helper: đọc Oracle LOB → Buffer
  async readOracleLob(lob: any): Promise<Buffer | null> {
    if (!lob) return null;
    if (Buffer.isBuffer(lob)) return lob;
    if (typeof lob.getData === 'function') {
      const data = await lob.getData();
      return Buffer.isBuffer(data) ? data : Buffer.from(String(data), 'utf8');
    }
    return Buffer.from(String(lob), 'utf8');
  }
}
```

### 6.6 `src/masking/masking.engine.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { Role } from '../common/types/role.enum';

export type FieldType =
  | 'phone'
  | 'cccd'
  | 'account_number'
  | 'card_number'
  | 'cvv'
  | 'balance'
  | 'email'
  | 'address'
  | 'date_of_birth';

export type MaskLevel = 'full_mask' | 'partial' | 'reveal';

@Injectable()
export class MaskingEngine {
  /**
   * Mask một giá trị theo field type và viewer role.
   * @param value     - Plaintext gốc (đã decrypt)
   * @param field     - Loại trường dữ liệu
   * @param role      - Role của người xem
   * @param isPinVerified - true nếu customer đã nhập đúng PIN
   */
  mask(
    value: string,
    field: FieldType,
    role: Role,
    isPinVerified = false,
  ): string {
    if (!value) return this.fullMask(field);

    // Customer đã xác thực PIN → hiện toàn bộ
    if (role === Role.CUSTOMER && isPinVerified) {
      return value;
    }

    switch (role) {
      case Role.CUSTOMER:
        return this.maskForCustomer(value, field);
      case Role.TELLER:
        return this.maskForTeller(value, field);
      case Role.ADMIN:
        return this.maskForAdmin(value, field);
      default:
        return this.fullMask(field);
    }
  }

  // ── CUSTOMER (chưa xác thực PIN) ──────────────────────────────
  private maskForCustomer(value: string, field: FieldType): string {
    switch (field) {
      case 'phone':
        // 0912345678 → 091****678
        return value.replace(/^(\d{3})\d{4}(\d{3})$/, '$1****$2');
      case 'cccd':
        // 079204001234 → 079*****1234
        return value.replace(/^(\d{3})\d{5}(\d{4})$/, '$1*****$2');
      case 'account_number':
        // 1234567890 → ******7890
        return value.replace(/^\d+(\d{4})$/, '******$1');
      case 'card_number':
        // 9876543210123456 → **** **** **** 3456
        return value.replace(/^(\d{4})\d{8}(\d{4})$/, '**** **** **** $2');
      case 'cvv':
        return '***';
      case 'balance':
        // Ẩn số dư — phải dùng PIN
        return '••••••';
      case 'email':
        // user@gmail.com → us***@gmail.com
        return value.replace(/^(\w{2})\w+(@.+)$/, '$1***$2');
      case 'date_of_birth':
        // 01/01/1990 → **/**/1990
        return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '**/**/$3');
      case 'address':
        // Ẩn số nhà, chỉ giữ quận/thành phố
        return value.split(',').slice(-2).join(',').trim();
      default:
        return value;
    }
  }

  // ── TELLER (nhân viên giao dịch) ─────────────────────────────
  private maskForTeller(value: string, field: FieldType): string {
    switch (field) {
      case 'phone':
        // 0912345678 → 09*****123
        return value.replace(/^(\d{2})\d{5}(\d{3})$/, '$1*****$2');
      case 'email':
        // user@gmail.com → ***@gmail.com (chỉ hiện domain)
        return value.replace(/^.+(@.+)$/, '***$1');
      case 'cccd':
        // Ẩn hoàn toàn với teller
        return this.fullMask('cccd');
      case 'card_number':
        return this.fullMask('card_number');
      case 'cvv':
        return '***';
      case 'balance':
        // Teller thấy khoảng, không thấy chính xác
        return this.balanceRange(value);
      case 'account_number':
        // Teller thấy 4 số cuối để xác nhận
        return value.replace(/^\d+(\d{4})$/, '******$1');
      case 'date_of_birth':
        // Teller thấy năm sinh để xác minh tuổi
        return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '**/**/$3');
      case 'address':
        return value.split(',').slice(-2).join(',').trim();
      default:
        return value;
    }
  }

  // ── ADMIN (quản trị hệ thống) ─────────────────────────────────
  private maskForAdmin(value: string, field: FieldType): string {
    // Admin thấy thông tin định danh (để quản lý)
    // Không thấy thông tin tài chính
    switch (field) {
      case 'phone':
        return value.replace(/^(\d{3})\d{5}(\d{2})$/, '$1*****$2');
      case 'email':
        return value; // Admin cần email đầy đủ để quản lý
      case 'cccd':
        return this.fullMask('cccd');
      case 'card_number':
        return this.fullMask('card_number');
      case 'cvv':
        return '***';
      case 'balance':
        return this.fullMask('balance'); // Admin KHÔNG thấy số dư
      case 'account_number':
        return value.replace(/^\d+(\d{4})$/, '******$1');
      case 'date_of_birth':
        return value.replace(/^(\d{2})\/(\d{2})\/(\d{4})$/, '**/**/$3');
      case 'address':
        return value.split(',').slice(-1)[0]?.trim() || this.fullMask('address');
      default:
        return value;
    }
  }

  private balanceRange(value: string): string {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '*** đ';
    if (num < 1_000_000) return '< 1 triệu đ';
    if (num < 10_000_000) return '1-10 triệu đ';
    if (num < 100_000_000) return '10-100 triệu đ';
    return '> 100 triệu đ';
  }

  private fullMask(field: FieldType): string {
    const masks: Record<FieldType, string> = {
      phone: '**********',
      cccd: '************',
      account_number: '**********',
      card_number: '**** **** **** ****',
      cvv: '***',
      balance: '••••••',
      email: '***@***.***',
      address: '***',
      date_of_birth: '**/**/****',
    };
    return masks[field] || '***';
  }
}
```

### 6.7 `src/modules/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuditService } from '../../audit/audit.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private userRepo: Repository<User>,
    private jwtService: JwtService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ip: string) {
    const exists = await this.userRepo.findOne({ where: { username: dto.username } });
    if (exists) throw new ConflictException('Tên đăng nhập đã tồn tại');

    // Băm mật khẩu — 12 rounds ≈ 250ms (đủ chậm để chống brute force)
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = this.userRepo.create({
      username: dto.username,
      passwordHash,
      role: dto.role || 'customer',
    });
    await this.userRepo.save(user);

    await this.auditService.log('REGISTER', user.id, null, ip, `Role: ${user.role}`);
    return { message: 'Đăng ký thành công' };
  }

  async login(dto: LoginDto, ip: string) {
    const user = await this.userRepo.findOne({ where: { username: dto.username } });

    // KHÔNG phân biệt "user không tồn tại" và "sai mật khẩu" (chống user enumeration)
    const isValid = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;

    if (!user || !isValid || !user.isActive) {
      await this.auditService.log('LOGIN_FAIL', user?.id || null, null, ip, `Username: ${dto.username}`);
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không đúng');
    }

    const token = this.jwtService.sign({
      sub: user.id,
      username: user.username,
      role: user.role,
    });

    await this.auditService.log('LOGIN_SUCCESS', user.id, null, ip, `Role: ${user.role}`);
    return { accessToken: token, role: user.role };
  }
}
```

### 6.8 `src/modules/customers/customers.service.ts`

```typescript
import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { Customer } from './entities/customer.entity';
import { AesService } from '../../crypto/services/aes.service';
import { MaskingEngine, FieldType } from '../../masking/masking.engine';
import { AuditService } from '../../audit/audit.service';
import { Role } from '../../common/types/role.enum';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    private aes: AesService,
    private masking: MaskingEngine,
    private audit: AuditService,
  ) {}

  // ── TẠO PROFILE KHÁCH HÀNG ───────────────────────────────────
  async createProfile(userId: string, dto: any, ip: string) {
    // Mã hoá từng trường nhạy cảm
    const [phone, cccd, dob, address] = await Promise.all([
      this.aes.encrypt(dto.phone),
      this.aes.encrypt(dto.cccd),
      this.aes.encrypt(dto.dateOfBirth),
      this.aes.encrypt(dto.address),
    ]);

    // Băm PIN 6 số — TÁCH BIỆT với password đăng nhập
    const pinHash = dto.pin ? await bcrypt.hash(dto.pin, 12) : null;

    const customer = this.customerRepo.create({
      userId,
      fullName: dto.fullName,
      email: dto.email,
      phone: this.aes.serialize(phone),
      cccd: this.aes.serialize(cccd),
      dateOfBirth: this.aes.serialize(dob),
      address: this.aes.serialize(address),
      pinHash,
    });

    await this.customerRepo.save(customer);
    await this.audit.log('CREATE_PROFILE', userId, customer.id, ip, 'Profile created');
    return { message: 'Tạo hồ sơ thành công' };
  }

  // ── XEM PROFILE (có masking) ──────────────────────────────────
  async getProfile(
    customerId: string,
    viewerId: string,
    viewerRole: Role,
    isPinVerified: boolean,
    ip: string,
  ) {
    const customer = await this.customerRepo.findOne({ where: { id: customerId } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const isOwner = customer.userId === viewerId;

    // Decrypt (chỉ khi là owner, teller hoặc admin có quyền xem field đó)
    const canDecrypt = isOwner || viewerRole === Role.TELLER || viewerRole === Role.ADMIN;

    const [phone, cccd, dob, address] = canDecrypt
      ? await Promise.all([
          this.aes.decrypt(this.aes.deserialize(customer.phone as Buffer)),
          this.aes.decrypt(this.aes.deserialize(customer.cccd as Buffer)),
          this.aes.decrypt(this.aes.deserialize(customer.dateOfBirth as Buffer)),
          this.aes.decrypt(this.aes.deserialize(customer.address as Buffer)),
        ])
      : [null, null, null, null];

    // Áp mask theo role
    const roleToUse = isOwner ? Role.CUSTOMER : viewerRole;
    const pinMode = isOwner && isPinVerified;

    await this.audit.log(
      'VIEW_PROFILE',
      viewerId,
      customerId,
      ip,
      `Role: ${viewerRole}, PinVerified: ${isPinVerified}`,
    );

    return {
      id: customer.id,
      fullName: customer.fullName,             // Tên: luôn hiện
      email: this.masking.mask(customer.email, 'email', roleToUse, pinMode),
      phone: phone ? this.masking.mask(phone, 'phone', roleToUse, pinMode) : this.masking.mask('', 'phone', roleToUse),
      cccd: cccd ? this.masking.mask(cccd, 'cccd', roleToUse, pinMode) : this.masking.mask('', 'cccd', roleToUse),
      dateOfBirth: dob ? this.masking.mask(dob, 'date_of_birth', roleToUse, pinMode) : '**/**/****',
      address: address ? this.masking.mask(address, 'address', roleToUse, pinMode) : '***',
      isPinVerified: pinMode,
    };
  }

  // ── XÁC THỰC PIN 6 SỐ ────────────────────────────────────────
  async verifyPin(customerId: string, userId: string, pin: string, ip: string): Promise<boolean> {
    const customer = await this.customerRepo.findOne({ where: { id: customerId, userId } });
    if (!customer || !customer.pinHash) return false;

    const valid = await bcrypt.compare(pin, customer.pinHash);
    await this.audit.log(
      valid ? 'PIN_VERIFY_SUCCESS' : 'PIN_VERIFY_FAIL',
      userId,
      customerId,
      ip,
      valid ? 'PIN verified' : 'Wrong PIN',
    );
    return valid;
  }

  // ── ĐẶT/ĐỔI PIN ──────────────────────────────────────────────
  async setPin(customerId: string, userId: string, newPin: string, ip: string) {
    if (!/^\d{6}$/.test(newPin)) {
      throw new Error('PIN phải là 6 chữ số');
    }
    const customer = await this.customerRepo.findOne({ where: { id: customerId, userId } });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    customer.pinHash = await bcrypt.hash(newPin, 12);
    await this.customerRepo.save(customer);
    await this.audit.log('PIN_CHANGED', userId, customerId, ip, 'PIN updated');
    return { message: 'Đổi PIN thành công' };
  }
}
```

### 6.9 `src/modules/customers/customers.controller.ts`

```typescript
import {
  Controller, Get, Post, Put, Body, Param, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { CustomersService } from './customers.service';
import { VerifyPinDto } from './dto/verify-pin.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  // Customer tạo hồ sơ lần đầu
  @Post('profile')
  @Roles(Role.CUSTOMER)
  createProfile(@Body() dto: any, @Req() req: any) {
    return this.service.createProfile(req.user.sub, dto, req.ip);
  }

  // Xem hồ sơ của mình (customer) — có partial mask
  @Get('me')
  @Roles(Role.CUSTOMER)
  getMyProfile(@Req() req: any) {
    const pinVerified = req.session?.pinVerified === req.user.sub;
    return this.service.getProfile(req.user.customerId, req.user.sub, Role.CUSTOMER, pinVerified, req.ip);
  }

  // Xác thực PIN để xem full info
  @Post('me/verify-pin')
  @Roles(Role.CUSTOMER)
  @HttpCode(HttpStatus.OK)
  async verifyPin(@Body() dto: VerifyPinDto, @Req() req: any) {
    const valid = await this.service.verifyPin(req.user.customerId, req.user.sub, dto.pin, req.ip);
    if (valid) {
      // Lưu trạng thái PIN verified vào JWT session ngắn hạn
      // Frontend lưu flag isPinVerified = true trong memory (không localStorage)
      return { verified: true, message: 'Xác thực PIN thành công' };
    }
    return { verified: false, message: 'PIN không đúng' };
  }

  // Đặt/đổi PIN
  @Put('me/pin')
  @Roles(Role.CUSTOMER)
  setPin(@Body() body: { pin: string }, @Req() req: any) {
    return this.service.setPin(req.user.customerId, req.user.sub, body.pin, req.ip);
  }
}
```

### 6.10 `src/modules/teller/teller.controller.ts`

```typescript
import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { TellerService } from './teller.service';

@Controller('teller')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TELLER)
export class TellerController {
  constructor(private readonly service: TellerService) {}

  // Tìm kiếm khách hàng theo tên hoặc số tài khoản
  @Get('search')
  search(@Query('q') query: string, @Req() req: any) {
    return this.service.searchCustomer(query, req.user.sub, req.ip);
  }

  // Xem thông tin khách hàng (partial mask cho teller)
  @Get('customers/:id')
  getCustomer(@Param('id') id: string, @Req() req: any) {
    return this.service.getCustomerForTeller(id, req.user.sub, req.ip);
  }

  // Xem tài khoản ngân hàng của khách (balance ẩn)
  @Get('customers/:id/accounts')
  getAccounts(@Param('id') id: string, @Req() req: any) {
    return this.service.getAccountsForTeller(id, req.user.sub, req.ip);
  }
}
```

### 6.11 `src/modules/admin/admin.controller.ts`

```typescript
import { Controller, Get, Patch, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/types/role.enum';
import { AdminService } from './admin.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly service: AdminService) {}

  // Danh sách user (thông tin định danh, có partial mask)
  @Get('users')
  getUsers(@Query('page') page = 1, @Query('limit') limit = 20) {
    return this.service.getUsers(+page, +limit);
  }

  // Kích hoạt / vô hiệu hoá tài khoản
  @Patch('users/:id/status')
  toggleStatus(@Param('id') id: string, @Body() body: { isActive: boolean }, @Req() req: any) {
    return this.service.setUserStatus(id, body.isActive, req.user.sub, req.ip);
  }

  // Audit log — KHÔNG có plaintext dữ liệu nhạy cảm
  @Get('audit-logs')
  getAuditLogs(
    @Query('page') page = 1,
    @Query('limit') limit = 50,
    @Query('eventType') eventType?: string,
    @Query('userId') userId?: string,
  ) {
    return this.service.getAuditLogs(+page, +limit, eventType, userId);
  }

  // Thống kê hệ thống (số lượng, không có dữ liệu cá nhân)
  @Get('stats')
  getStats() {
    return this.service.getSystemStats();
  }
}
```

### 6.12 `src/modules/transactions/transactions.service.ts`

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Account } from '../accounts/entities/account.entity';
import { Transaction } from './entities/transaction.entity';
import { AesService } from '../../crypto/services/aes.service';
import { AuditService } from '../../audit/audit.service';
import * as crypto from 'crypto';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Account) private accountRepo: Repository<Account>,
    @InjectRepository(Transaction) private txRepo: Repository<Transaction>,
    private aes: AesService,
    private audit: AuditService,
    private dataSource: DataSource,
  ) {}

  async transfer(fromAccountId: string, toAccountNumber: string, amount: number, userId: string, ip: string) {
    if (amount <= 0) throw new BadRequestException('Số tiền phải lớn hơn 0');

    // Dùng Oracle transaction để đảm bảo ACID
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const fromAccount = await queryRunner.manager.findOne(Account, {
        where: { id: fromAccountId },
        lock: { mode: 'pessimistic_write' }, // Oracle SELECT FOR UPDATE
      });
      if (!fromAccount) throw new NotFoundException('Tài khoản nguồn không tồn tại');

      const toAccount = await queryRunner.manager.findOne(Account, {
        where: { accountNumber: toAccountNumber },
        lock: { mode: 'pessimistic_write' },
      });
      if (!toAccount) throw new NotFoundException('Tài khoản đích không tồn tại');

      // Decrypt số dư (từ BLOB)
      const fromBalance = parseFloat(
        await this.aes.decrypt(this.aes.deserialize(fromAccount.balance as Buffer)) || '0'
      );
      if (fromBalance < amount) throw new BadRequestException('Số dư không đủ');

      const toBalance = parseFloat(
        await this.aes.decrypt(this.aes.deserialize(toAccount.balance as Buffer)) || '0'
      );

      // Cập nhật số dư — re-encrypt với IV mới
      const newFromBalance = fromBalance - amount;
      const newToBalance = toBalance + amount;

      fromAccount.balance = this.aes.serialize(await this.aes.encrypt(String(newFromBalance)));
      toAccount.balance = this.aes.serialize(await this.aes.encrypt(String(newToBalance)));

      await queryRunner.manager.save(fromAccount);
      await queryRunner.manager.save(toAccount);

      // Ghi transaction record — amount cũng được encrypt
      const tx = queryRunner.manager.create(Transaction, {
        fromAccountId: fromAccount.id,
        toAccountId: toAccount.id,
        amount: this.aes.serialize(await this.aes.encrypt(String(amount))),
        transactionType: 'transfer',
        status: 'completed',
        referenceCode: `TXN${Date.now()}${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      });
      await queryRunner.manager.save(tx);

      await queryRunner.commitTransaction();

      await this.audit.log('TRANSFER', userId, tx.id, ip,
        `From: ${fromAccountId}, To: ${toAccountNumber}, Ref: ${tx.referenceCode}`);

      return { message: 'Chuyển khoản thành công', referenceCode: tx.referenceCode };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getHistory(accountId: string, userId: string, ip: string, page = 1, limit = 10) {
    const [txs, total] = await this.txRepo.findAndCount({
      where: [{ fromAccountId: accountId }, { toAccountId: accountId }],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    // Decrypt amount rồi mask (hiện khoảng, không hiện chính xác)
    const items = await Promise.all(
      txs.map(async (tx) => {
        const amountStr = await this.aes.decrypt(this.aes.deserialize(tx.amount as Buffer));
        return {
          id: tx.id,
          type: tx.transactionType,
          amount: amountStr ? `${parseFloat(amountStr).toLocaleString('vi-VN')} đ` : '*** đ',
          direction: tx.fromAccountId === accountId ? 'debit' : 'credit',
          status: tx.status,
          referenceCode: tx.referenceCode,
          createdAt: tx.createdAt,
        };
      })
    );

    await this.audit.log('VIEW_TRANSACTIONS', userId, accountId, ip, `Page: ${page}`);
    return { items, total, page, limit };
  }
}
```

### 6.13 `src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtModule } from '@nestjs/jwt';
import { CryptoModule } from './crypto/crypto.module';
import { MaskingModule } from './masking/masking.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TellerModule } from './modules/teller/teller.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    // Biến môi trường
    ConfigModule.forRoot({ isGlobal: true }),

    // Rate limiting — chống brute force
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,   // 1 phút
      limit: 30,    // 30 request/phút cho API thường
    }, {
      name: 'auth',
      ttl: 900000,  // 15 phút
      limit: 5,     // 5 lần login sai → block 15 phút
    }]),

    // Oracle connection
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle',
        host: config.getOrThrow('DB_HOST'),
        port: +config.getOrThrow('DB_PORT'),
        username: config.getOrThrow('DB_USER'),
        password: config.getOrThrow('DB_PASSWORD'),
        serviceName: config.getOrThrow('DB_SERVICE'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false, // KHÔNG dùng synchronize với Oracle
        logging: config.get('NODE_ENV') === 'development',
        extra: {
          poolMin: 2,
          poolMax: 10,
        },
      }),
    }),

    // Business modules
    CryptoModule,
    MaskingModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    AccountsModule,
    TransactionsModule,
    TellerModule,
    AdminModule,
  ],
})
export class AppModule {}
```

### 6.14 `src/main.ts`

```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  // HTTPS với self-signed cert
  const httpsOptions = {
    key: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'key.pem')),
    cert: fs.readFileSync(path.join(__dirname, '..', 'ssl', 'cert.pem')),
  };

  const app = await NestFactory.create(AppModule, { httpsOptions });

  // Security headers
  app.use(helmet.default());

  // Cookie parser (cho JWT httpOnly cookie)
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // Input validation — tự động validate DTO
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,        // Strip các field không khai báo trong DTO
    forbidNonWhitelisted: true,
    transform: true,
  }));

  // CORS — chỉ cho phép frontend origin
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'https://localhost',
    credentials: true,      // Cho phép gửi cookie
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Server running on https://localhost:${port}/api`);
}
bootstrap();
```

---

## 7. Frontend — React

### 7.1 Khởi Tạo

```bash
cd secure-bank-app
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install axios react-router-dom @tanstack/react-query
npm install -D @types/react-router-dom tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

### 7.2 `src/api/client.ts`

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,   // Tự động gửi httpOnly cookie
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: redirect về login nếu 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default api;
```

### 7.3 Component `MaskedField`

Hiển thị một trường dữ liệu có thể đang bị mask. Không có toggle ẩn/hiện — để xem full cần qua PinModal.

```tsx
// src/components/common/MaskedField.tsx
interface MaskedFieldProps {
  label: string;
  value: string;       // Giá trị đã mask từ server
  isMasked?: boolean;  // true nếu đang hiển thị dạng mask
  className?: string;
}

export function MaskedField({ label, value, isMasked = true, className = '' }: MaskedFieldProps) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      <span className={`font-mono text-sm ${isMasked ? 'text-gray-400 tracking-widest' : 'text-gray-800'}`}>
        {value || '—'}
      </span>
    </div>
  );
}
```

### 7.4 Component `PinModal` — Nhập PIN 6 Số

```tsx
// src/components/common/PinModal.tsx
import { useState, useRef, useEffect } from 'react';
import api from '../../api/client';

interface PinModalProps {
  customerId: string;
  onSuccess: () => void;
  onClose: () => void;
}

export function PinModal({ customerId, onSuccess, onClose }: PinModalProps) {
  const [pin, setPin] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus ô đầu tiên
  useEffect(() => { inputs.current[0]?.focus(); }, []);

  const handleChange = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return; // Chỉ nhận chữ số
    const newPin = [...pin];
    newPin[index] = value;
    setPin(newPin);
    // Auto-advance
    if (value && index < 5) inputs.current[index + 1]?.focus();
    // Auto-submit khi đủ 6 số
    if (newPin.every(d => d) && newPin.join('').length === 6) {
      handleSubmit(newPin.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (pinValue?: string) => {
    const pinStr = pinValue || pin.join('');
    if (pinStr.length !== 6) { setError('Vui lòng nhập đủ 6 số'); return; }

    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/customers/me/verify-pin`, { pin: pinStr });
      if (data.verified) {
        onSuccess();
      } else {
        setError('PIN không đúng. Vui lòng thử lại.');
        setPin(['', '', '', '', '', '']);
        inputs.current[0]?.focus();
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-800">Xác thực PIN</h2>
          <p className="text-sm text-gray-500 mt-1">Nhập mã PIN 6 số để xem thông tin đầy đủ</p>
        </div>

        {/* PIN Input Grid */}
        <div className="flex gap-3 justify-center mb-6">
          {pin.map((digit, i) => (
            <input
              key={i}
              ref={el => { inputs.current[i] = el; }}
              type="password"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-xl
                         focus:border-blue-500 focus:outline-none transition-colors
                         bg-gray-50"
            />
          ))}
        </div>

        {/* Error */}
        {error && (
          <p className="text-red-500 text-sm text-center mb-4">{error}</p>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <button onClick={onClose}
            className="flex-1 py-3 border border-gray-300 rounded-xl text-gray-600 hover:bg-gray-50">
            Huỷ
          </button>
          <button onClick={() => handleSubmit()} disabled={loading || pin.some(d => !d)}
            className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700
                       disabled:opacity-50 disabled:cursor-not-allowed font-medium">
            {loading ? 'Đang kiểm tra...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

### 7.5 Trang Dashboard Khách Hàng

```tsx
// src/pages/customer/DashboardPage.tsx
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';
import { MaskedField } from '../../components/common/MaskedField';
import { PinModal } from '../../components/common/PinModal';

export function DashboardPage() {
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinVerified, setPinVerified] = useState(false);

  const { data: profile, refetch } = useQuery({
    queryKey: ['my-profile', pinVerified],
    queryFn: async () => {
      const { data } = await api.get('/customers/me');
      return data;
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ['my-accounts'],
    queryFn: async () => {
      const { data } = await api.get('/accounts/me');
      return data;
    },
  });

  const handlePinSuccess = async () => {
    // Gọi API với header xác nhận PIN đã được verify
    await api.post('/customers/me/verify-pin-session');
    setPinVerified(true);
    setShowPinModal(false);
    refetch();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl p-6 text-white mb-6">
          <h1 className="text-2xl font-bold">Xin chào, {profile?.fullName}</h1>
          <p className="text-blue-200 text-sm mt-1">
            {pinVerified ? '🔓 Đang xem thông tin đầy đủ' : '🔒 Thông tin đang được bảo vệ'}
          </p>
        </div>

        {/* Tài khoản */}
        <div className="grid gap-4 mb-6">
          {accounts?.map((acc: any) => (
            <div key={acc.id} className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Số tài khoản</p>
                  <p className="font-mono font-semibold">{acc.accountNumber}</p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium
                  ${acc.accountType === 'saving' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                  {acc.accountType === 'saving' ? 'Tiết kiệm' : 'Thanh toán'}
                </span>
              </div>

              {/* Số dư */}
              <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">Số dư khả dụng</p>
                  <p className="text-2xl font-bold text-gray-800 mt-1">
                    {pinVerified ? `${parseFloat(acc.balance).toLocaleString('vi-VN')} đ` : acc.balanceMasked}
                  </p>
                </div>
                {!pinVerified && (
                  <button onClick={() => setShowPinModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    Xem số dư
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Thông tin cá nhân */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Thông tin cá nhân</h2>
            {!pinVerified && (
              <button onClick={() => setShowPinModal(true)}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                🔑 Nhập PIN để xem đầy đủ
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MaskedField label="Họ và tên" value={profile?.fullName} isMasked={false} />
            <MaskedField label="Email" value={profile?.email} isMasked={!pinVerified} />
            <MaskedField label="Số điện thoại" value={profile?.phone} isMasked={!pinVerified} />
            <MaskedField label="CCCD" value={profile?.cccd} isMasked={!pinVerified} />
            <MaskedField label="Ngày sinh" value={profile?.dateOfBirth} isMasked={!pinVerified} />
            <MaskedField label="Địa chỉ" value={profile?.address} isMasked={!pinVerified} />
          </div>
        </div>

      </div>

      {showPinModal && (
        <PinModal
          customerId={profile?.id}
          onSuccess={handlePinSuccess}
          onClose={() => setShowPinModal(false)}
        />
      )}
    </div>
  );
}
```

### 7.6 Trang Teller

```tsx
// src/pages/teller/TellerPage.tsx
import { useState } from 'react';
import api from '../../api/client';
import { MaskedField } from '../../components/common/MaskedField';

export function TellerPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/teller/search?q=${encodeURIComponent(query)}`);
      setResults(data);
    } finally {
      setLoading(false);
    }
  };

  const viewCustomer = async (id: string) => {
    const { data } = await api.get(`/teller/customers/${id}`);
    setSelected(data);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <span className="text-orange-500 text-xl">⚠️</span>
        <div>
          <p className="font-medium text-orange-800">Quyền truy cập Nhân viên Giao dịch</p>
          <p className="text-sm text-orange-600">
            Bạn chỉ thấy thông tin cần thiết cho nghiệp vụ. Dữ liệu nhạy cảm đã được che giấu.
            Mọi tra cứu đều được ghi lại trong hệ thống.
          </p>
        </div>
      </div>

      {/* Tìm kiếm */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
        <h2 className="font-semibold mb-4">Tra cứu khách hàng</h2>
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Tên khách hàng hoặc số tài khoản..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            className="flex-1 border rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500"
          />
          <button onClick={search} disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            Tìm kiếm
          </button>
        </div>

        {/* Kết quả tìm kiếm */}
        {results.length > 0 && (
          <div className="mt-4 divide-y">
            {results.map((r: any) => (
              <div key={r.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{r.fullName}</p>
                  <p className="text-sm text-gray-500">{r.email}</p>
                </div>
                <button onClick={() => viewCustomer(r.id)}
                  className="text-sm text-blue-600 hover:underline">
                  Xem chi tiết
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chi tiết khách hàng (partial mask cho teller) */}
      {selected && (
        <div className="bg-white rounded-xl shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">Thông tin khách hàng</h2>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full">
              Đã được che giấu theo quyền Teller
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <MaskedField label="Họ và tên" value={selected.fullName} isMasked={false} />
            <MaskedField label="Email" value={selected.email} isMasked={true} />
            <MaskedField label="Số điện thoại" value={selected.phone} isMasked={true} />
            <MaskedField label="Ngày sinh (năm)" value={selected.dateOfBirth} isMasked={true} />
            <MaskedField label="CCCD" value={selected.cccd} isMasked={true} />
            <MaskedField label="Số dư (ước tính)" value={selected.balanceRange} isMasked={true} />
          </div>
        </div>
      )}
    </div>
  );
}
```

### 7.7 Trang Admin

```tsx
// src/pages/admin/AdminDashboard.tsx
import { useQuery } from '@tanstack/react-query';
import api from '../../api/client';

export function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: async () => (await api.get('/admin/stats')).data,
  });

  const { data: users, refetch } = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => (await api.get('/admin/users?page=1&limit=20')).data,
  });

  const toggleStatus = async (userId: string, isActive: boolean) => {
    await api.patch(`/admin/users/${userId}/status`, { isActive });
    refetch();
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Cảnh báo quyền */}
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex gap-3">
        <span className="text-red-500 text-xl">🔐</span>
        <p className="text-sm text-red-700">
          <strong>Quản trị viên:</strong> Bạn thấy thông tin định danh nhưng
          <strong> KHÔNG thể xem dữ liệu tài chính</strong> của khách hàng.
          Mọi thao tác đều được ghi nhật ký.
        </p>
      </div>

      {/* Thống kê */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Tổng người dùng', value: stats?.totalUsers, color: 'blue' },
          { label: 'Khách hàng', value: stats?.customers, color: 'green' },
          { label: 'Nhân viên', value: stats?.tellers, color: 'yellow' },
          { label: 'Tài khoản khoá', value: stats?.inactive, color: 'red' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow-sm p-5 text-center">
            <p className="text-3xl font-bold text-gray-800">{s.value ?? '...'}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Danh sách user */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Danh sách người dùng</h2>
          <p className="text-xs text-gray-500 mt-1">SĐT và email đã được che giấu một phần</p>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              {['Tên đăng nhập','Họ tên','Email (masked)','SĐT (masked)','Role','Trạng thái','Thao tác'].map(h => (
                <th key={h} className="px-4 py-3 text-left">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {users?.items?.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm">{u.username}</td>
                <td className="px-4 py-3">{u.fullName}</td>
                <td className="px-4 py-3 font-mono text-sm text-gray-500">{u.email}</td>
                <td className="px-4 py-3 font-mono text-sm text-gray-500">{u.phone}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium
                    ${u.role === 'admin' ? 'bg-red-100 text-red-700'
                    : u.role === 'teller' ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-green-100 text-green-700'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {u.isActive ? 'Hoạt động' : 'Khoá'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button onClick={() => toggleStatus(u.id, !u.isActive)}
                    className={`text-xs px-3 py-1 rounded ${u.isActive ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}>
                    {u.isActive ? 'Khoá' : 'Mở khoá'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

## 8. Biến Môi Trường

### 8.1 `backend/.env.example`

```env
# ── Oracle Database ──────────────────────────────────────────────
DB_HOST=oracle
DB_PORT=1521
DB_SERVICE=XEPDB1
DB_USER=smask_user
DB_PASSWORD=YourAppPassword123

# ── Oracle root (chỉ dùng cho docker-compose) ───────────────────
DB_ROOT_PASSWORD=YourRootPassword123

# ── JWT ──────────────────────────────────────────────────────────
# Sinh bằng: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=REPLACE_WITH_64_CHAR_HEX
JWT_EXPIRES_IN=8h

# ── Crypto ───────────────────────────────────────────────────────
# Sinh bằng: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
AES_MASTER_KEY=REPLACE_WITH_64_CHAR_HEX
HMAC_SECRET=REPLACE_WITH_64_CHAR_HEX_DIFFERENT

# ── App ──────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
FRONTEND_URL=https://localhost
```

### 8.2 Script sinh key

```bash
# Sinh 3 key ngẫu nhiên (chạy 3 lần riêng biệt)
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('AES_MASTER_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('HMAC_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## 9. Vai Trò & Quy Tắc Masking

### 9.1 Bảng tổng hợp đầy đủ

| Trường | DB lưu | Customer (chưa PIN) | Customer (sau PIN) | Teller | Admin |
|--------|--------|---------------------|--------------------|--------|-------|
| Họ tên | Plaintext | ✅ Đầy đủ | ✅ Đầy đủ | ✅ Đầy đủ | ✅ Đầy đủ |
| Email | Plaintext | `us***@gmail.com` | ✅ Đầy đủ | `***@gmail.com` | ✅ Đầy đủ |
| SĐT | Encrypted | `091****678` | ✅ Đầy đủ | `09*****123` | `091*****78` |
| CCCD | Encrypted | `079*****1234` | ✅ Đầy đủ | `************` | `************` |
| Ngày sinh | Encrypted | `**/**/1990` | ✅ Đầy đủ | `**/**/1990` | `**/**/****` |
| Địa chỉ | Encrypted | Quận/TP | ✅ Đầy đủ | Quận/TP | Thành phố |
| Số TK | Plaintext | `******7890` | `******7890`* | `******7890` | `******7890` |
| Số thẻ | Encrypted | `**** **** **** 3456` | ✅ Đầy đủ | `**** **** **** ****` | `**** **** **** ****` |
| CVV | Encrypted | `***` | ✅ Đầy đủ | `***` | `***` |
| Số dư | Encrypted | `••••••` | ✅ Đầy đủ | `10-100 triệu đ` | `••••••` |
| Lịch sử GD | Encrypted | Tóm tắt | ✅ Đầy đủ | Ẩn | Ẩn |

> *Số tài khoản luôn hiện 4 số cuối để customer xác nhận đúng tài khoản khi chuyển tiền.

### 9.2 Quy Tắc PIN

- PIN là 6 chữ số (`^\d{6}$`)
- Băm bằng bcrypt 12 rounds — **tách biệt hoàn toàn** với mật khẩu đăng nhập
- Sau khi xác thực PIN thành công, frontend lưu `isPinVerified = true` trong React state (không localStorage)
- Trạng thái PIN verified mất khi reload trang → phải nhập lại
- Không giới hạn số lần nhập sai PIN (đây là ứng dụng học thuật; production cần thêm lockout)

---

## 10. Luồng Bảo Mật Chi Tiết

### 10.1 Luồng Đăng Ký

```
1. Client gửi POST /api/auth/register { username, password, role }
   → HTTPS/TLS bảo vệ kênh truyền

2. Server:
   a. Validate input (DTO + ValidationPipe)
   b. Kiểm tra username không trùng
   c. bcrypt.hash(password, 12) → lưu PASSWORD_HASH vào USERS
   d. Ghi AUDIT_LOG: event='REGISTER'

3. Response: 201 Created { message: 'Đăng ký thành công' }
   (Không trả về password hash hay bất kỳ data nhạy cảm nào)
```

### 10.2 Luồng Đăng Nhập

```
1. POST /api/auth/login { username, password }
2. bcrypt.compare(password, storedHash)
   → Nếu sai: trả 401 "Tên đăng nhập hoặc mật khẩu không đúng"
     (Không nói rõ cái nào sai — chống user enumeration)
3. Sinh JWT: { sub, username, role, exp }
4. Ghi AUDIT_LOG
5. Response: { accessToken, role }
   → Frontend lưu token (nên dùng httpOnly cookie)
```

### 10.3 Luồng Lưu Dữ Liệu Nhạy Cảm

```
Client gửi { phone: "0912345678", ... }
                    ↓ HTTPS
Server:
  1. Validate input
  2. aes.encrypt("0912345678")
     → IV = randomBytes(12)          ← Mới mỗi lần
     → AES-256-GCM(plaintext, key, IV)
     → tag = cipher.getAuthTag()     ← 16 bytes auth
     → hmac = HMAC-SHA256(cipher+IV+tag, hmacKey)
     → CellValue = { type, algo, payload, iv, tag, hmac }
  3. serialize(CellValue) → Buffer → lưu Oracle BLOB
```

### 10.4 Luồng Đọc & Hiển Thị

```
Client gửi GET /api/customers/me
                    ↓
Server:
  1. Verify JWT → biết userId, role
  2. Lấy BLOB từ Oracle → deserialize → CellValue
  3. Kiểm tra HMAC → nếu sai → báo lỗi, ghi audit "TAMPERED"
  4. AES-GCM decrypt(CellValue) → plaintext
  5. masking.mask(plaintext, fieldType, role, isPinVerified)
  6. Trả JSON với giá trị đã mask
```

### 10.5 Luồng Xác Thực PIN

```
Client bấm "Xem số dư" → PinModal hiện
User nhập 6 số → POST /api/customers/me/verify-pin { pin: "123456" }
Server:
  1. Lấy PIN_HASH từ DB
  2. bcrypt.compare(pin, pinHash)
  3. Ghi AUDIT_LOG: PIN_VERIFY_SUCCESS/FAIL
  4. Trả { verified: true/false }
Client:
  5. Nếu verified → set isPinVerified = true trong React state
  6. Re-fetch profile với flag pinVerified=true trong request
  7. Server trả plaintext (không mask)
```

### 10.6 Luồng Chuyển Khoản

```
POST /api/transactions/transfer
  { toAccountNumber, amount, fromAccountId }

Server:
  1. Verify JWT → đảm bảo fromAccountId thuộc về user này
  2. Oracle TRANSACTION bắt đầu (ACID)
  3. SELECT FOR UPDATE fromAccount → lock row
  4. Decrypt balance → kiểm tra đủ tiền
  5. Cập nhật balance = encrypt(newBalance) với IV mới
  6. Lưu TRANSACTION record (amount encrypted)
  7. COMMIT
  8. Ghi AUDIT_LOG
```

---

## 11. API Endpoints

### Public (không cần auth)

| Method | Endpoint | Body | Mô tả |
|--------|----------|------|-------|
| POST | `/api/auth/register` | `{username, password, role}` | Đăng ký |
| POST | `/api/auth/login` | `{username, password}` | Đăng nhập |

### Customer (role: customer)

| Method | Endpoint | Body / Query | Mô tả |
|--------|----------|------|-------|
| POST | `/api/customers/profile` | `{fullName, email, phone, cccd, dob, address, pin}` | Tạo hồ sơ |
| GET | `/api/customers/me` | — | Xem hồ sơ (partial mask) |
| PUT | `/api/customers/me` | fields to update | Cập nhật hồ sơ |
| POST | `/api/customers/me/verify-pin` | `{pin}` | Xác thực PIN |
| PUT | `/api/customers/me/pin` | `{pin}` | Đặt/đổi PIN |
| GET | `/api/accounts/me` | — | Danh sách tài khoản |
| GET | `/api/accounts/:id/transactions` | `?page&limit` | Lịch sử giao dịch |
| POST | `/api/transactions/transfer` | `{fromAccountId, toAccountNumber, amount}` | Chuyển khoản |

### Teller (role: teller)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/teller/search?q=` | Tìm khách hàng |
| GET | `/api/teller/customers/:id` | Xem thông tin (partial mask) |
| GET | `/api/teller/customers/:id/accounts` | Tài khoản khách (balance ẩn) |

### Admin (role: admin)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/api/admin/users?page&limit` | Danh sách user (masked) |
| PATCH | `/api/admin/users/:id/status` | Khoá/mở khoá tài khoản |
| GET | `/api/admin/audit-logs?page&eventType&userId` | Xem nhật ký |
| GET | `/api/admin/stats` | Thống kê hệ thống |

---

## 12. Hướng Dẫn Chạy

### 12.1 Lần Đầu (First Run)

```bash
# 1. Clone hoặc tạo project
mkdir secure-bank-app && cd secure-bank-app

# 2. Tạo SSL certificate
mkdir -p backend/ssl
openssl req -x509 -newkey rsa:4096 \
  -keyout backend/ssl/key.pem \
  -out backend/ssl/cert.pem \
  -days 365 -nodes \
  -subj "/C=VN/ST=Hanoi/L=Hanoi/O=BankDemo/CN=localhost"

# 3. Tạo file .env
cp backend/.env.example backend/.env
# Chỉnh sửa backend/.env: điền các key ngẫu nhiên vào
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"  # chạy 3 lần

# 4. Build và chạy
docker compose up --build -d

# 5. Kiểm tra Oracle sẵn sàng (mất 2-3 phút)
docker logs oracle-xe --follow
# Đợi thấy: DATABASE IS READY TO USE!

# 6. Chạy seed data
docker exec oracle-xe sqlplus smask_user/$(grep DB_PASSWORD backend/.env | cut -d= -f2)@//localhost/XEPDB1 @/container-entrypoint-initdb.d/02_seed.sql
```

### 12.2 Chạy Development (không Docker)

```bash
# Terminal 1: Oracle vẫn dùng Docker
docker compose up oracle -d

# Terminal 2: Backend
cd backend
npm install
npm run start:dev

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
```

### 12.3 Kiểm Tra Hoạt Động

```bash
# Test API (sau khi chạy xong)
curl -k https://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"Admin@123456"}'

# Kiểm tra Oracle
docker exec -it oracle-xe sqlplus smask_user/App123@//localhost/XEPDB1
SQL> SELECT TABLE_NAME FROM USER_TABLES;
SQL> SELECT ID, FULL_NAME, EMAIL FROM CUSTOMERS;
# Xem cột PHONE — phải là BLOB ciphertext, không phải plaintext
SQL> SELECT UTL_RAW.CAST_TO_VARCHAR2(PHONE) FROM CUSTOMERS WHERE ROWNUM <= 1;
```

---

## 13. Seed Data

### `backend/sql/02_seed.sql`

```sql
-- ================================================================
-- Seed data cho demo
-- Mật khẩu mặc định tất cả: Admin@123456 (bcrypt hash của nó)
-- PIN mặc định tất cả: 123456 (bcrypt hash)
-- ================================================================

-- Hash của "Admin@123456" với bcrypt 12 rounds (tính sẵn)
-- PHẢI generate lại bằng Node.js nếu dùng production:
-- node -e "require('bcryptjs').hash('Admin@123456',12).then(console.log)"

-- Tài khoản Admin
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-ADMIN-001',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq6kSom',
    'admin'
);

-- Tài khoản Teller
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-TELLER-001',
    'teller01',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq6kSom',
    'teller'
);

-- Tài khoản Customers
INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-CUST-001', 'nguyenvana',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq6kSom',
    'customer'
);

INSERT INTO USERS (ID, USERNAME, PASSWORD_HASH, ROLE) VALUES (
    'USR-CUST-002', 'tranthib',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq6kSom',
    'customer'
);

COMMIT;

-- !! Lưu ý: Dữ liệu CUSTOMERS (phone, cccd, balance) cần được tạo bằng
-- Node.js script vì phải qua AES-256-GCM encrypt.
-- Chạy: node backend/scripts/seed-customers.js sau khi backend khởi động.
```

### `backend/scripts/seed-customers.js` — Tạo dữ liệu có mã hoá

```javascript
// Chạy: node scripts/seed-customers.js
// Yêu cầu: .env đã được cấu hình, Oracle đang chạy

require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const oracledb = require('oracledb');

const masterKey = Buffer.from(process.env.AES_MASTER_KEY, 'hex');
const hmacSecret = Buffer.from(process.env.HMAC_SECRET, 'hex');

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const p = ciphertext.toString('base64');
  const i = iv.toString('base64');
  const t = tag.toString('base64');
  const hmac = crypto.createHmac('sha256', hmacSecret).update(`${p}.${i}.${t}`).digest('hex');
  return Buffer.from(JSON.stringify({ type: 'encrypted', algo: 'aes-256-gcm', payload: p, iv: i, tag: t, hmac }));
}

async function seed() {
  const conn = await oracledb.getConnection({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
  });

  const pinHash = await bcrypt.hash('123456', 12);

  const customers = [
    { userId: 'USR-CUST-001', fullName: 'Nguyễn Văn A', email: 'nguyenvana@gmail.com',
      phone: '0912345678', cccd: '079204001234', dob: '15/03/1990', address: '123 Lê Lợi, Quận 1, TP.HCM' },
    { userId: 'USR-CUST-002', fullName: 'Trần Thị B', email: 'tranthib@yahoo.com',
      phone: '0987654321', cccd: '001300012345', dob: '22/07/1995', address: '45 Nguyễn Huệ, Hoàn Kiếm, Hà Nội' },
  ];

  for (const c of customers) {
    const id = `CUST-${Date.now()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    await conn.execute(
      `INSERT INTO CUSTOMERS (ID, USER_ID, FULL_NAME, EMAIL, PHONE, CCCD, DATE_OF_BIRTH, ADDRESS, PIN_HASH)
       VALUES (:id, :userId, :fullName, :email, :phone, :cccd, :dob, :address, :pinHash)`,
      {
        id, userId: c.userId, fullName: c.fullName, email: c.email,
        phone: { val: encrypt(c.phone), type: oracledb.BUFFER },
        cccd:  { val: encrypt(c.cccd),  type: oracledb.BUFFER },
        dob:   { val: encrypt(c.dob),   type: oracledb.BUFFER },
        address: { val: encrypt(c.address), type: oracledb.BUFFER },
        pinHash,
      }
    );

    // Tạo tài khoản ngân hàng
    const accNum = `VN${Math.floor(Math.random() * 9000000000 + 1000000000)}`;
    await conn.execute(
      `INSERT INTO ACCOUNTS (ID, CUSTOMER_ID, ACCOUNT_NUMBER, ACCOUNT_TYPE, BALANCE)
       VALUES (:id, :custId, :accNum, 'saving', :balance)`,
      {
        id: `ACC-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        custId: id,
        accNum,
        balance: { val: encrypt(String(Math.floor(Math.random() * 100000000 + 1000000))), type: oracledb.BUFFER },
      }
    );
    console.log(`✅ Created customer: ${c.fullName}`);
  }

  await conn.commit();
  await conn.close();
  console.log('🎉 Seed hoàn thành!');
}

seed().catch(console.error);
```

---

## 14. Checklist Kiểm Thử

### 14.1 Kiểm Thử Bảo Mật (Bắt Buộc)

```
□ HASH
  □ PASSWORD_HASH trong DB bắt đầu $2a$12$ (bcrypt 12 rounds)
  □ PIN_HASH trong DB bắt đầu $2a$12$ (bcrypt 12 rounds, TÁCH BIỆT)
  □ Đăng nhập với mật khẩu sai → 401, không leak thông tin

□ ENCRYPT
  □ PHONE, CCCD, BALANCE trong Oracle là BLOB JSON ciphertext
  □ SELECT UTL_RAW.CAST_TO_VARCHAR2(PHONE) FROM CUSTOMERS → thấy JSON encrypted
  □ Encrypt cùng giá trị 2 lần → 2 ciphertext KHÁC NHAU (IV random)
  □ Sửa BLOB trong DB → decrypt trả null (HMAC fail)

□ MASKING
  □ Customer chưa PIN: SĐT = 091****678, số dư = ••••••
  □ Customer sau PIN: tất cả đầy đủ
  □ Teller: SĐT = 09*****123, email = ***@gmail.com, CCCD ẩn, số dư = khoảng
  □ Admin: email đầy đủ, SĐT partial, số dư ẩn hoàn toàn
  □ Admin KHÔNG có nút/cách nào xem số dư của customer

□ PIN
  □ PIN 6 số, nhập sai → "PIN không đúng", không xem được
  □ PIN đúng → xem toàn bộ thông tin không mask
  □ Reload trang → phải nhập PIN lại

□ KÊNH TRUYỀN
  □ Mọi request dùng HTTPS (https:// trên address bar)
  □ HTTP redirect về HTTPS

□ AUDIT
  □ Sau login: SELECT * FROM AUDIT_LOGS → thấy LOGIN_SUCCESS
  □ Sau xem profile: thấy VIEW_PROFILE
  □ Detail trong AUDIT_LOG không chứa plaintext phone/cccd/balance
```

### 14.2 Kịch Bản Demo (10 phút)

```
[1:00] Mở sqlplus → SELECT PHONE, CCCD, BALANCE FROM CUSTOMERS
       → Minh hoạ: toàn là ciphertext blob

[2:00] Đăng nhập admin → Admin Dashboard
       → Thấy danh sách user, SĐT masked, không có số dư
       → Audit Log: thấy các sự kiện

[3:30] Đăng nhập customer (nguyenvana / Admin@123456)
       → Dashboard: SĐT 091****678, số dư ••••••
       → Thông tin cá nhân: CCCD masked, email masked

[5:00] Bấm "Xem số dư" → PinModal hiện
       → Nhập PIN: 123456
       → Số dư hiện đầy đủ, toàn bộ thông tin unmasked

[7:00] Đăng nhập customer B (tranthib)
       → Vào xem trang A (nếu có route) → KHÔNG thấy gì

[8:30] Đăng nhập teller (teller01)
       → Tìm kiếm "Nguyễn Văn A"
       → Thấy SĐT 09*****123, email ***@gmail.com, KHÔNG thấy CCCD/số dư

[9:30] Mở DevTools → Network → Xem request
       → HTTPS, response chứa giá trị đã masked
       → Không có plaintext trong response

[10:00] Kết luận: 4 cơ chế bảo mật hoạt động độc lập
```

---

## Ghi Chú Quan Trọng Cho AI Agent

1. **KHÔNG dùng `synchronize: true`** với Oracle trong TypeORM — luôn dùng SQL migration thủ công
2. **Oracle BLOB** trả về dưới dạng LOB object — luôn dùng helper `readOracleLob()` trước khi xử lý
3. **Tên bảng/cột Oracle** phải UPPERCASE trong SQL, TypeORM entity dùng `@Entity('CUSTOMERS')`
4. **serviceName** kết nối Oracle XE là `XEPDB1`, **không phải** `XE`
5. **IV ngẫu nhiên** cho mỗi lần encrypt — `crypto.randomBytes(12)` — không tái sử dụng
6. **PIN ≠ Password** — hai bcrypt hash riêng biệt, hai endpoint riêng biệt
7. **Audit log** không được chứa plaintext — chỉ log metadata (userId, fieldName, timestamp)
8. **HMAC** verify trước khi decrypt — nếu fail thì `return null`, không throw exception (tránh timing attack)
9. **httpOnly cookie** cho JWT — không lưu trong localStorage (XSS protection)
10. **isPinVerified** lưu trong React state (in-memory) — không localStorage, không server session

---

*Tài liệu này đủ để AI Agent build hoàn chỉnh ứng dụng từ đầu đến cuối.*
