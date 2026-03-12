# Hướng dẫn cài đặt & chạy dự án

## Mục lục

1. [Yêu cầu hệ thống](#1-yêu-cầu-hệ-thống)
2. [Clone và chuẩn bị môi trường](#2-clone-và-chuẩn-bị-môi-trường)
3. [Tạo SSL certificate (bắt buộc)](#3-tạo-ssl-certificate-bắt-buộc)
4. [Chạy Docker](#4-chạy-docker)
5. [Kiểm tra hệ thống](#5-kiểm-tra-hệ-thống)
6. [Tài khoản mặc định để test](#6-tài-khoản-mặc-định-để-test)
7. [Dừng và xoá container](#7-dừng-và-xoá-container)
8. [Quy tắc commit lên Git](#8-quy-tắc-commit-lên-git)

---

## 1. Yêu cầu hệ thống

| Phần mềm       | Phiên bản tối thiểu | Kiểm tra                 |
| -------------- | ------------------- | ------------------------ |
| Docker Desktop | 24+                 | `docker --version`       |
| Docker Compose | 2.x (tích hợp sẵn)  | `docker compose version` |
| Git            | bất kỳ              | `git --version`          |
| OpenSSL        | bất kỳ              | `openssl version`        |

> **Windows:** OpenSSL được cài kèm với Git for Windows. Hoặc dùng WSL.

---

## 2. Clone và chuẩn bị môi trường

```bash
# Clone repo
git clone <URL_REPO> CSAT_Final_Project
cd CSAT_Final_Project
```

### Tạo file `.env`

File `.env` **không được commit** vào Git (chứa secret). Bạn phải tự tạo:

```bash
cp backend/.env.example backend/.env
```

> Nếu repo chưa có `.env.example`, tạo file `backend/.env` với nội dung sau (thay đổi giá trị nếu cần):

```dotenv
# ── Oracle Database ──────────────────────────────────────────────
DB_HOST=oracle
DB_PORT=1521
DB_SERVICE=XEPDB1
DB_USER=smask_user
DB_PASSWORD=App123456!

# ── Oracle root (chỉ dùng cho docker-compose) ───────────────────
DB_ROOT_PASSWORD=Root123456!

# ── JWT ──────────────────────────────────────────────────────────
JWT_SECRET=change_this_to_a_random_64char_hex_string
JWT_EXPIRES_IN=8h

# ── Crypto ───────────────────────────────────────────────────────
AES_MASTER_KEY=change_this_to_a_random_64char_hex_string
HMAC_SECRET=change_this_to_a_random_64char_hex_string

# ── App ──────────────────────────────────────────────────────────
PORT=3000
NODE_ENV=development
FRONTEND_URL=https://localhost
```

> **Lưu ý bảo mật:** `JWT_SECRET`, `AES_MASTER_KEY`, `HMAC_SECRET` phải là chuỗi hex ngẫu nhiên 64 ký tự. Tạo bằng lệnh:
>
> ```bash
> openssl rand -hex 32
> ```

---

## 3. Tạo SSL certificate (bắt buộc)

Frontend dùng HTTPS (cổng 443). Nginx cần file `cert.pem` và `key.pem` trong thư mục `backend/ssl/`.

**Thư mục này không được commit lên Git.**

### Cách tạo self-signed certificate:

```bash
# Tạo thư mục nếu chưa có
mkdir -p backend/ssl

# Tạo certificate tự ký (hiệu lực 365 ngày)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem \
  -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=CSAT/CN=localhost"
```

**Trên Windows PowerShell** (nếu không có openssl trong PATH):

```powershell
# Dùng OpenSSL từ Git for Windows
& "C:\Program Files\Git\usr\bin\openssl.exe" req -x509 -nodes -days 365 -newkey rsa:2048 `
  -keyout backend/ssl/key.pem `
  -out backend/ssl/cert.pem `
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=CSAT/CN=localhost"
```

Kết quả: `backend/ssl/cert.pem` và `backend/ssl/key.pem` được tạo ra.

---

## 4. Chạy Docker

```bash
# Đứng tại thư mục gốc dự án
cd CSAT_Final_Project

# Build image và khởi động toàn bộ stack
docker compose up -d --build
```

### Lần đầu chạy — Oracle cần thời gian khởi tạo database (~2–3 phút)

Theo dõi tiến trình:

```bash
docker logs -f oracle-xe
```

Chờ đến khi thấy dòng:

```
DATABASE IS READY TO USE!
```

Sau đó backend sẽ tự kết nối và khởi động. Kiểm tra:

```bash
docker logs -f bank-backend
```

Chờ đến khi thấy:

```
[NestApplication] Nest application successfully started
```

---

## 5. Kiểm tra hệ thống

| Service     | URL                      | Trạng thái mong đợi       |
| ----------- | ------------------------ | ------------------------- |
| Frontend    | https://localhost        | Trang đăng nhập           |
| Backend API | https://localhost/api    | Redirect về frontend      |
| Oracle EM   | http://localhost:5500/em | Oracle Enterprise Manager |

> **Trình duyệt cảnh báo SSL** do dùng self-signed certificate → chọn "Advanced" → "Proceed to localhost" để tiếp tục.

---

## 6. Tài khoản mặc định để test

Seed data được tạo tự động từ `backend/sql/02_seed.sql` khi Oracle khởi động lần đầu.

| Vai trò        | Tên đăng nhập | Mật khẩu       |
| -------------- | ------------- | -------------- |
| Admin          | `admin`       | `Admin@123`    |
| Giao dịch viên | `teller01`    | `Teller@123`   |
| Khách hàng     | `customer01`  | `Customer@123` |
| Khách hàng     | `customer02`  | `Customer@123` |

> Xem danh sách đầy đủ trong `backend/sql/02_seed.sql`.

---

## 7. Dừng và xoá container

```bash
# Dừng (giữ nguyên dữ liệu Oracle)
docker compose down

# Dừng VÀ xoá toàn bộ dữ liệu Oracle (reset hoàn toàn)
docker compose down -v
```

> ⚠️ `down -v` sẽ xoá volume `oracle_data` — toàn bộ dữ liệu database bị mất, lần chạy tiếp theo sẽ seed lại từ đầu.

### Build lại sau khi thay đổi code:

```bash
# Chỉ build lại backend và frontend (giữ Oracle)
docker compose up -d --build backend frontend
```

### Migration database (khi có thay đổi schema):

```bash
# Copy file migration vào container rồi chạy
docker cp backend/sql/04_migrate_user_profile.sql oracle-xe:/tmp/migrate.sql
docker exec -it oracle-xe sqlplus "smask_user/App123456!@//localhost/XEPDB1" '@/tmp/migrate.sql'
```

---

## 8. Quy tắc commit lên Git

### ✅ NÊN commit

```
CSAT_Final_Project/
├── backend/
│   ├── src/               ✅ Toàn bộ source code NestJS
│   ├── sql/               ✅ Schema, seed, migration SQL
│   ├── package.json       ✅
│   ├── tsconfig*.json     ✅
│   ├── nest-cli.json      ✅
│   ├── Dockerfile         ✅
│   └── .env.example       ✅ File mẫu (KHÔNG chứa secret thật)
├── frontend/
│   ├── src/               ✅ Toàn bộ source code React
│   ├── public/            ✅ (nếu có)
│   ├── index.html         ✅
│   ├── package.json       ✅
│   ├── vite.config.ts     ✅
│   ├── tailwind.config.js ✅
│   ├── tsconfig*.json     ✅
│   ├── nginx.conf         ✅
│   └── Dockerfile         ✅
├── docker-compose.yml     ✅
├── .gitignore             ✅
├── README.md              ✅
└── SETUP_GUIDE.md         ✅
```

### ❌ KHÔNG được commit

| File/Thư mục                | Lý do                                        |
| --------------------------- | -------------------------------------------- |
| `backend/.env`              | Chứa mật khẩu DB, JWT secret, crypto key     |
| `backend/ssl/cert.pem`      | SSL certificate — mỗi máy tự tạo             |
| `backend/ssl/key.pem`       | SSL private key — **tuyệt đối không public** |
| `backend/ssl/` (cả thư mục) | Như trên                                     |
| `node_modules/`             | Cài lại bằng `npm install`                   |
| `backend/dist/`             | Build output — tạo lại khi build Docker      |
| `frontend/dist/`            | Build output — tạo lại khi build Docker      |
| `*.log`                     | Log file                                     |

> Những file này đã được liệt kê trong `.gitignore` ở thư mục gốc.

### Tạo `.env.example` để người mới biết cần những biến gì:

```bash
# Tạo file mẫu (xoá giá trị secret thật, giữ tên biến và giải thích)
cp backend/.env backend/.env.example
# Sau đó mở .env.example và thay các giá trị nhạy cảm bằng placeholder
```

---

## Sơ đồ kiến trúc

```
Trình duyệt
    │  HTTPS :443
    ▼
┌─────────────────┐
│  Nginx (Docker) │  ← phục vụ React SPA
│  bank-frontend  │  ← proxy /api/* → backend
└────────┬────────┘
         │ HTTP :3000 (nội bộ Docker)
         ▼
┌─────────────────┐
│  NestJS Backend │  ← JWT Auth, mã hoá AES/HMAC
│  bank-backend   │
└────────┬────────┘
         │ TCP :1521 (nội bộ Docker)
         ▼
┌─────────────────┐
│  Oracle XE 21c  │  ← volume oracle_data
│  oracle-xe      │
└─────────────────┘
```
