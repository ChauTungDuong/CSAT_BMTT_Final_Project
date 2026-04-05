# Tài liệu thuật toán bảo mật trong project

Mục tiêu tài liệu này: giải thích ngắn gọn thuật toán nào dùng để làm gì, thuật toán nào nằm bên trong thuật toán nào, và luồng bảo mật tổng quát của hệ thống.

## 1) Thuật toán đang dùng và vai trò

| Thuật toán / Cơ chế         | Dùng để làm gì                                                       | Dùng ở đâu                          |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| RSA-OAEP (manual)           | Mã hóa AES session key khi truyền client <-> server                  | App-layer transport envelope        |
| AES-256-GCM (manual)        | Mã hóa + xác thực toàn vẹn payload truyền và dữ liệu nhạy cảm lưu DB | Transport payload, field encryption |
| PBKDF2-HMAC-SHA256 (manual) | Dẫn xuất key từ password (KEK) và băm password/PIN                   | Auth, key management                |
| HMAC-SHA256                 | Băm có khóa để lookup/unique mà không cần giải mã                    | email hash, account number hash     |
| SHA-256                     | Hàm băm nền cho HMAC, PBKDF2, MGF1                                   | Crypto primitives nội bộ            |
| MGF1(SHA-256)               | Mask generation trong RSA-OAEP                                       | RSA-OAEP manual                     |
| Masking (không phải mã hóa) | Ẩn dữ liệu theo role/PIN-verified khi trả về UI                      | Masking engine                      |
| JWT + sid (single-session)  | Xác thực phiên, thu hồi phiên khi cần                                | Auth/JwtStrategy/SessionRegistry    |

## 2) Thuật toán nào nằm trong thuật toán nào

- PBKDF2 dùng HMAC-SHA256.
- HMAC-SHA256 dùng SHA-256.
- RSA-OAEP dùng MGF1, và MGF1 dùng SHA-256.
- AES-GCM gồm:
- AES block cipher ở CTR mode (mã hóa dữ liệu).
- GHASH để tạo auth tag (xác thực toàn vẹn).

Tóm tắt chuỗi phụ thuộc:

- RSA-OAEP -> MGF1 -> SHA-256
- PBKDF2 -> HMAC-SHA256 -> SHA-256
- AES-GCM -> AES-CTR + GHASH

## 3) Mapping nhanh theo luồng code

- Transport bảo mật app-layer:
- Client mã hóa request bằng RSA-OAEP + AES-GCM.
- Server kiểm tra AAD/timestamp/nonce, giải mã và xử lý.
- Response mã hóa lại AES-GCM; frontend fail-hard nếu response nhạy cảm giải mã lỗi.

- Mã hóa dữ liệu lưu DB:
- Dữ liệu nhạy cảm (phone, cccd, address, account number, card data...) dùng AES-256-GCM.
- Email được mã hóa AES-GCM + băm HMAC-SHA256 để tra cứu/unique.

- Quản lý key theo user:
- DEK theo user dùng để mã hóa field.
- KEK được dẫn xuất từ password bằng PBKDF2 để wrap/unwrap DEK.
- Metadata key lưu wrapped DEK (và recovery wrapped DEK nếu bật cấu hình).

- Xác thực và phiên:
- Password/PIN hash bằng PBKDF2-HMAC-SHA256.
- JWT chứa sid; server kiểm tra sid active để enforce single-session.

## 4) Luồng bảo mật tổng quát (end-to-end)

1. Client gửi request:

- Sinh AES session key.
- Mã hóa session key bằng RSA-OAEP.
- Mã hóa payload bằng AES-GCM + AAD.

2. Server nhận request:

- Giải mã session key (RSA-OAEP).
- Verify và giải mã payload (AES-GCM + AAD + anti-replay).
- Thực thi business logic.

3. Server truy cập dữ liệu:

- Dẫn xuất/unwrap key cần thiết (PBKDF2 -> KEK -> DEK).
- Giải mã/mã hóa field nhạy cảm bằng AES-GCM.
- Tra cứu theo hash (HMAC-SHA256) cho các trường cần unique/find.

4. Server trả response:

- Áp masking theo role/chính sách hiển thị.
- Mã hóa response bằng AES-GCM (transport envelope).
- Client giải mã; nếu dữ liệu nhạy cảm mà decrypt fail -> đóng phiên (fail-hard).

## 5) Ghi chú quan trọng

- Masking khác mã hóa: masking chỉ che khi hiển thị, không bảo vệ dữ liệu gốc khi lưu.
- HMAC hash chỉ phục vụ lookup/unique, không dùng để khôi phục plaintext.
- Hệ thống hiện tại tắt master-key fallback cho dữ liệu nhạy cảm: xử lý crypto phụ thuộc user context + runtime DEK.
