# 📋 Hướng dẫn triển khai (Deployment Guide)

## Mục lục

1. [Port Mapping & Network](#port-mapping--network)
2. [Chuẩn bị Server](#chuẩn-bị-server)
3. [Clone và Setup Ban Đầu](#clone-và-setup-ban-đầu)
4. [Database Migration & Seeding](#database-migration--seeding)
5. [Khởi động Ứng dụng](#khởi-động-ứng-dụng)
6. [Kiểm tra Hệ thống](#kiểm-tra-hệ-thống)
7. [Các Lệnh Hữu ích](#các-lệnh-hữu-ích)
8. [Troubleshooting](#troubleshooting)

---

## Port Mapping & Network

### Cấu hình Port trên Server

Ứng dụng sử dụng các port sau:

| Dịch vụ              | Port Container | Port Server     | Mục đích                         |
| -------------------- | -------------- | --------------- | -------------------------------- |
| **Frontend (Nginx)** | 443            | **3002**        | Ứng dụng chính - HTTPS           |
| **Backend (NestJS)** | 3000           | Nội bộ (Docker) | API Server                       |
| **Monitor (Crypto)** | 80             | 3003            | Công cụ theo dõi (optional)      |
| **Oracle Database**  | 1521           | 1521            | Database - KHÔNG expose ra ngoài |
| **Oracle EM**        | 5500           | Nội bộ (Docker) | Oracle Enterprise Manager        |

### Lưu ý về Network

- **Frontend** (port 3002) là điểm vào chính, proxy requests đến backend
- **Backend** chỉ nhận requests từ frontend qua Docker network (bank-backend:3000)
- **Database** chỉ chép nhận connections từ backend container
- **Monitor** là công cụ debug, có thể tắt trong production nếu không cần

---

## Chuẩn bị Server

### Yêu cầu Phần mềm

```bash
# Kiểm tra các công cụ đã cài
docker --version          # Docker 24+
docker compose version    # Docker Compose 2.x+
git --version            # Git
```

### Firewall Rules (Nếu Có)

Mở các port sau trên tường lửa:

```
3002/tcp - Frontend (HTTPS)
3003/tcp - Monitor (tuỳ chọn)
1521/tcp - Database (chỉ từ backend, nếu external access)
```

### Dung lượng ổ cứng

- **Oracle Data Volume**: ~10GB (tuỳ dung lượng dữ liệu)
- **Docker Images**: ~2-3GB
- **Đề nghị**: Tối thiểu 20GB dành riêng cho project

---

## Clone và Setup Ban Đầu

### Bước 1: Clone Repository

```bash
# Clone project
git clone <REPO_URL> CSAT_Final_Project
cd CSAT_Final_Project

# Hoặc nếu đã có, cập nhật mới nhất
git pull origin main
```

### Bước 2: Tạo File Environment

**Backend .env** (BẮTBUỘC - không được commit):

```bash
# Copy từ template
cp backend/.env.example backend/.env

# Hoặc tạo thủ công (thay đổi password mạnh):
cat > backend/.env << 'EOF'
# ── Oracle Database ──────────────────────────────────────────────
DB_HOST=oracle
DB_PORT=1521
DB_SERVICE=XEPDB1
DB_USER=smask_user
DB_PASSWORD=App@123456Secure!

# ── Oracle root (chỉ cho docker-compose) ───────────────────
DB_ROOT_PASSWORD=Root@123456Secure!

# ── JWT ──────────────────────────────────────────────────────
JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_EXPIRES_IN=8h

# ── Encryption ───────────────────────────────────────────────
AES_MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
HMAC_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")

# ── App ──────────────────────────────────────────────────────
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-domain-or-ip:3002
EOF
```

> **⚠️ Bảo mật**: Thay đổi tất cả passwords và secrets

### Bước 3: Tạo SSL Certificate

SSL certificate là bắt buộc cho HTTPS:

```bash
# Tạo thư mục ssl (nếu chưa có)
mkdir -p backend/ssl

# Tạo certificate tự ký (365 ngày)
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem \
  -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Banking/CN=localhost"
```

**Trên server sản phẩm**, nên dùng certificate từ Certificate Authority (Let's Encrypt, etc.):

```bash
# Ví dụ với certbot (Let's Encrypt)
sudo certbot certonly --standalone -d your-domain.com

# Copy certificate
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem backend/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem backend/ssl/key.pem
sudo chown $USER:$USER backend/ssl/*.pem
```

### Bước 4: Xác minh Cấu trúc

```bash
# Đảm bảo cấu trúc tồn tại
ls -la backend/.env              # ✓ File environment
ls -la backend/ssl/              # ✓ cert.pem, key.pem
ls -la docker-compose.yml        # ✓ File compose
```

---

## Database Migration & Seeding

### 💾 Data Initialization

Database schema được tạo tự động qua Docker:

1. **Schema** - File `/backend/sql/01_schema.sql` chạy tự động khi Oracle start
2. **Dữ liệu Ban Đầu** - File `/backend/sql/02_seed.sql` chạy sau schema

### Bước 1: Start Database

```bash
# Start chỉ database (chờ ~120s để khởi động)
docker compose up -d oracle

# Kiểm tra logs
docker compose logs -f oracle
```

Khi thấy dòng này → database sẵn sàng:

```
XE(2): Completed: ALTER DATABASE OPEN
```

Hoặc kiểm tra health:

```bash
docker compose ps
# Trạng thái oracle phải là "healthy" chứ không phải "starting"
```

### Bước 2: Chạy migrations thêm (không bắt buộc)

Nếu cần chạy các migration khác:

```bash
# Vào docker container
docker exec -it oracle-xe sqlplus smask_user/App123456!@XEPDB1

# Hoặc chạy SQL file từ host
docker exec -i oracle-xe sqlplus smask_user/App123456!@XEPDB1 < backend/sql/04_migrate_user_profile.sql

# Thoát
exit
```

### Bước 3: Seed Dữ liệu Ban Đầu (tuỳ chọn)

Nếu cần thêm dữ liệu test:

```bash
# Script Node để seed
npm run seed  # Nếu có script seed trong backend/package.json

# Hoặc chạy trực tiếp
node backend/scripts/seed-customers.js

# Hoặc chạy SQL thủ công
docker exec -i oracle-xe sqlplus smask_user/App123456!@XEPDB1 < backend/sql/02_seed.sql
```

### Các File SQL Sẵn Có

| File                          | Mục đích                | Tự động chạy?            |
| ----------------------------- | ----------------------- | ------------------------ |
| `01_schema.sql`               | Tạo tables, indexes     | ✅ Tự động (Docker init) |
| `02_seed.sql`                 | Dữ liệu sample          | ✅ Tự động (Docker init) |
| `03_redact.sql`               | Redact sensitive data   | ❌ Manual                |
| `04_migrate_user_profile.sql` | Migration user profiles | ❌ Manual                |
| `fix_passwords.sql`           | Fix password issues     | ❌ Manual                |

---

## Khởi động Ứng dụng

### Cách 1: Start Tất cả Services

```bash
# Build + Start tất cả containers
docker compose up -d --build

# Hoặc chỉ start (không rebuild)
docker compose up -d

# Theo dõi logs của tất cả services
docker compose logs -f

# Hoặc logs riêng từng service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f oracle
```

**Thời gian khởi động**:

- Oracle database: 90-120s (khởi động lần đầu)
- Backend: 10-20s
- Frontend: 5-10s
- **Tổng**: ~2-3 phút lần đầu

### Cách 2: Start Từng Service

```bash
# Start theo thứ tự
docker compose up -d oracle
docker compose up -d backend
docker compose up -d frontend
docker compose up -d monitor  # optional

# Hoặc trong 1 dòng
docker compose up -d oracle backend frontend
```

### Cách 3: Kiểm tra Từng Bước

```bash
# 1. Oracle database - Kiểm tra health
docker compose logs oracle | grep -i "completed\|error"

# 2. Backend - Kiểm tra startup logs
docker compose logs backend | tail -20

# 3. Frontend - Kiểm tra health
docker compose exec frontend curl -k https://localhost:443
```

---

## Kiểm tra Hệ thống

### Status Containers

```bash
# Xem tất cả containers
docker compose ps

# Output mong muốn:
# NAME              STATUS
# bank-backend      Up ...
# bank-frontend     Up ...
# oracle-xe         Up ... (healthy)
# bank-monitor      Up ...
```

### Test Endpoints

```bash
# Test Backend API
curl -X GET http://localhost:3000/health

# Test Frontend (HTTPS, tự ký nên bỏ -k verify)
curl -k https://localhost:3002

# Test Monitor
curl http://localhost:3003
```

### Health Checks

```bash
# Script kiểm tra toàn bộ hệ thống
cat > check_health.sh << 'EOF'
#!/bin/bash
echo "🔍 Checking application health..."
echo ""

echo "📊 Container Status:"
docker compose ps

echo ""
echo "🗄️ Database Health:"
docker compose exec -T oracle healthcheck.sh > /dev/null 2>&1 && echo "✅ Oracle: OK" || echo "❌ Oracle: FAILED"

echo ""
echo "🔌 Network Connectivity:"
docker compose exec -T backend curl -s http://bank-backend:3000/health > /dev/null && echo "✅ Backend: OK" || echo "❌ Backend: FAILED"

echo ""
echo "✅ Health check completed!"
EOF

chmod +x check_health.sh
./check_health.sh
```

### Logs Giám sát

```bash
# Theo dõi logs real-time
docker compose logs -f --tail=50

# Lọc error logs
docker compose logs backend | grep -i error

# Export logs
docker compose logs > logs-backup-$(date +%Y%m%d).txt
```

---

## Các Lệnh Hữu ích

### Quản lý Containers

```bash
# Restart một service
docker compose restart backend

# Rebuild một image
docker compose up -d --build backend

# Xóa containers (dữ liệu database vẫn lưu)
docker compose down

# Xóa tất cả bao gồm volumes (⚠️ mất dữ liệu!)
docker compose down -v

# Dừng tất cả (không xóa)
docker compose stop

# Start lại (không rebuild)
docker compose start
```

### Database Commands

```bash
# Truy cập SQL CLI
docker exec -it oracle-xe sqlplus smask_user/App123456!@XEPDB1

# Chạy SQL script
docker exec -i oracle-xe sqlplus -s smask_user/App123456!@XEPDB1 << EOF
  SELECT count(*) FROM users;
  EXIT;
EOF

# Export database
docker exec -i oracle-xe expdp smask_user/App123456!@XEPDB1 DIRECTORY=DATA_PUMP_DIR DUMPFILE=backup.dmp

# Backup volumes
docker run --rm -v csat_final_project_oracle_data:/data -v $(pwd)/backups:/backups \
  alpine tar czf /backups/oracle-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Backend Operations

```bash
# Chạy migrations NestJS
docker exec bank-backend npm run migration:run

# Chạy seeds
docker exec bank-backend npm run seed

# Build lại
docker exec bank-backend npm run build

# Test
docker exec bank-backend npm test
```

### Frontend Operations

```bash
# Rebuild static assets
docker exec bank-frontend npm run build

# Clear cache
docker compose restart frontend

# View logs
docker compose logs frontend
```

### Troubleshooting Commands

```bash
# Kiểm tra tài nguyên
docker stats

# Kiểm tra lỗi DNS
docker exec bank-backend nslookup bank-backend

# Kiểm tra port đang sử dụng
netstat -tulpn | grep 3002
# Trên Windows
netstat -ano | findstr :3002

# Xem chi tiết container
docker inspect bank-backend
```

---

## Troubleshooting

### 🔴 Frontend không kết nối Backend

**Triệu chứng**: `ERR_CONNECTION_REFUSED` khi gọi API

**Nguyên nhân & Giải pháp**:

```bash
# 1. Kiểm tra backend đã start chưa
docker compose ps backend  # Status phải là "Up"

# 2. Kiểm tra network kết nối
docker exec bank-frontend curl http://bank-backend:3000/health

# 3. Nếu vẫn lỗi, restart backend
docker compose restart backend

# 4. Kiểm tra logs backend
docker compose logs backend | grep -i "error\|listening"
```

### 🔴 SSL Certificate Lỗi

**Triệu chứng**: `SEC_ERROR_UNKNOWN_ISSUER` hoặc timeout trên port 443

**Giải pháp**:

```bash
# 1. Kiểm tra cert tồn tại
ls -la backend/ssl/cert.pem backend/ssl/key.pem

# 2. Kiểm tra cert hợp lệ
openssl x509 -in backend/ssl/cert.pem -text -noout

# 3. Tạo lại cert
rm -f backend/ssl/{cert.pem,key.pem}
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Banking/CN=localhost"

# 4. Restart frontend
docker compose restart frontend
```

### 🔴 Database Connection Timeout

**Triệu chứng**: Backend logs: `ORA-12514: TNS:listener does not currently know`

**Giải pháp**:

```bash
# 1. Kiểm tra Oracle health
docker compose logs oracle | grep "Completed"

# 2. Đợi Oracle khởi động hoàn toàn (2 phút lần đầu)
sleep 120 && docker compose up -d backend

# 3. Kiểm tra port 1521
docker exec bank-backend curl -v telnet://bank-oracle:1521

# 4. Restart Oracle
docker compose down oracle
docker compose up -d oracle
# Chờ ~120s
docker compose logs -f oracle | grep "Completed"
```

### 🔴 Port Đã Được Sử dụng

**Triệu chứng**: `Ports already allocated`

**Giải pháp**:

```bash
# 1. Tìm process sử dụng port
# Trên Linux/Mac
lsof -i :3002

# Trên Windows
netstat -ano | findstr :3002

# 2. Kill process (thay 12345 bằng PID)
kill 12345                    # Linux/Mac
taskkill /PID 12345 /F        # Windows

# 3. Hoặc thay đổi port trong docker-compose.yml
# Đổi "3002:443" thành "3004:443" (ví dụ)

# 4. Restart
docker compose up -d
```

### 🔴 Out of Memory / Disk Space

**Triệu chứng**: Container crashes hoặc services slow

**Giải pháp**:

```bash
# 1. Kiểm tra dung lượng
df -h
docker system df

# 2. Clean up
docker system prune -a --volumes  # ⚠️ Xóa tất cả unused

# 3. Nếu database volume quá lớn
docker exec oracle-xe sqlplus smask_user/App123456!@XEPDB1 << EOF
  PURGE RECYCLEBIN;
  COMMIT;
  EXIT;
EOF
```

### 🔴 Dữ liệu Không Hiển thị Admin Dashboard

**Triệu chứng**: Admin dashboard trống, hoặc không thấy users/accounts

**Giải pháp**:

```bash
# 1. Kiểm tra dữ liệu trong database
docker exec -it oracle-xe sqlplus smask_user/App123456!@XEPDB1
  SELECT count(*) FROM users;
  SELECT count(*) FROM customers;
  EXIT;

# 2. Nếu trống, chạy seed
docker exec bank-backend npm run seed

# 3. Hoặc chạy SQL seed thủ công
docker exec -i oracle-xe sqlplus smask_user/App123456!@XEPDB1 < backend/sql/02_seed.sql

# 4. Refresh frontend browser (Ctrl+Shift+R)
```

---

## Câu Hỏi Thường Gặp (FAQ)

### Q: Tôi muốn thay đổi port từ 3002 sang port khác?

A: Edit `docker-compose.yml`:

```yaml
frontend:
  ports:
    - "3004:443" # Thay 3002 thành 3004 (ví dụ)
```

Rồi chạy: `docker compose up -d --build`

### Q: Làm sao để login lần đầu?

A: Dùng tài khoản mặc định (xem `SETUP_GUIDE.md`):

- Admin: `admin` / `Admin123456!`
- Customer: `customer1` / `Customer123456!`

### Q: Có thể chạy backend + database mà không chạy frontend?

A: Có!

```bash
docker compose up -d oracle backend
# Rồi dùng API client (Postman, curl) gọi http://localhost:3000
```

### Q: Tôi có cần chạy Monitor?

A: Monitor là công cụ debugging crypto, không bắt buộc. Có thể comment out trong `docker-compose.yml` hoặc không truy cập nó.

### Q: Khi nào nên xóa volumes (docker compose down -v)?

A: Chỉ khi:

- Reset dữ liệu lại từ đầu
- Gặp lỗi database nghiêm trọng
- Chuyển môi trường khác

**Cảnh báo**: Xóa volumes = mất tất cả dữ liệu!

---

**Cần hỗ trợ?** Kiểm tra [SETUP_GUIDE.md](SETUP_GUIDE.md) hoặc logs: `docker compose logs`
