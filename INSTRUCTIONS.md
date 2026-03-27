# Hướng Dẫn Chạy Toàn Bộ Hệ Thống (Oracle XE + Backend + Frontend + Monitor)

Dự án hiện đã được tích hợp đầy đủ các tính năng bảo mật, thẻ ảo và hệ thống giám sát mã hóa (Crypto Monitor) chạy trong môi trường Docker.

## 1. Yêu Cầu Cơ Bản
- **Docker & Docker Compose**: Đã được cài đặt.
- **Biến Môi Trường**: Đảm bảo file `.env` trong thư mục `backend/` đã được cấu hình với các thông số hiện có của bạn:
  - `DB_ROOT_PASSWORD`, `DB_USER`, `DB_PASSWORD` (Dùng cho Oracle và Docker).
  - `AES_MASTER_KEY`, `HMAC_SECRET` (Đã có sẵn để phục vụ mã hóa AES-256-GCM).
  - `MAIL_USER`, `MAIL_PASSWORD` (Cần bổ sung nếu bạn muốn sử dụng tính năng gửi mã PIN qua Email).

## 2. Các Bước Khởi Động (Dùng Docker)
Đây là cách nhanh nhất để chạy toàn bộ hệ thống:

1. **Build và Chạy Containers**:
   ```powershell
   docker-compose up --build
   ```
2. **Kiểm tra trạng thái**:
   - Truy cập Ứng dụng Ngân hàng: **https://localhost** (cổng 443, mặc định dùng SSL).
   - Truy cập **Crypto Monitor**: **http://localhost:3001**.
   - Truy cập Backend API: **http://localhost:3000**.

## 3. Cập Nhật Database (Lưu ý quan trọng)
Sau khi các container đã khởi động thành công (đặc biệt là `oracle-xe`), bạn cần chạy script migration để cập nhật mật khẩu mặc định (`Password@123`) và chuẩn bị bảng thẻ ảo cho người dùng cũ:

1. Copy script `backend/migration.sql` vào container Oracle hoặc chạy qua công cụ kết nối database (DBeaver, SQL Developer, v.v.) kết nối tới `localhost:1521`.
2. Truy xuất vào container Oracle để chạy SQL:
   ```powershell
   docker exec -it oracle-xe sqlplus sys/Password123@localhost/XE as sysdba
   -- Sau đó dán nội dung từ migration.sql vào console.
   ```

## 4. Các Cổng Dịch Vụ
| Dịch vụ | Cổng (Host) | Chức năng |
| :--- | :--- | :--- |
| **Banking Frontend** | 80/443 | Trang chủ ngân hàng (Đăng ký/Giao dịch) |
| **Crypto Monitor** | 3001 | Giám sát các bước mã hóa AES-256-GCM thời gian thực |
| **NestJS Backend** | 3000 | Core Banking API & WebSockets |
| **Oracle XE** | 1521 | Cơ sở dữ liệu chính |

## 5. Lưu Ý Về Crypto Monitor
- Trang giám sát này chạy độc lập hoàn toàn với mã nguồn của người dùng cuối.
- Monitor kết nối trực tiếp đến backend qua WebSocket để nghe các sự kiện `encrypt`/`decrypt`.
- Payload và Auth Tag được hiển thị chi tiết cho từng bước giúp dễ dàng kiểm tra tính chính xác của thuật toán AES-GCM tự triển khai.
