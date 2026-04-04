# Kiến Trúc Bảo Mật Toàn Diện Của CSAT Bank

## 1. Mục tiêu tài liệu

Tài liệu này mô tả cách tổ chức bảo mật của project từ front-end đến backend, bao gồm:

- bảo mật đường truyền
- mã hóa dữ liệu lưu trữ
- cơ chế mặt nạ dữ liệu
- ràng buộc theo user/role
- cơ chế PIN và OTP
- cơ chế tạo khóa, bọc khóa và khôi phục mật khẩu
- đánh giá mức độ đáp ứng yêu cầu của đề tài: `Viết chương trình quản lý dữ liệu an toàn dưới dạng mặt nạ dữ liệu trên ORACLE bằng ngôn ngữ Typescript`

## 2. Kết luận ngắn gọn về RSA

RSA vẫn quan trọng trong project này, nhưng vai trò của nó không phải là mã hóa dữ liệu nghiệp vụ trong database.

RSA đang đảm nhận vai trò:

- trao đổi khóa phiên an toàn giữa front-end và backend
- bọc AES session key trong luồng transport envelope
- giúp payload request/response được mã hóa ở tầng ứng dụng

RSA không thay thế DEK/KEK cho dữ liệu lưu trữ. Dữ liệu nhạy cảm khi lưu DB vẫn được bảo vệ chủ yếu bởi AES-GCM với DEK theo user.

## 3. Bức tranh tổng thể

### 3.1 Ba lớp bảo mật chính

1. Lớp truyền tải

- HTTPS tại nginx reverse proxy
- thêm lớp application-layer envelope bằng RSA + AES-GCM

2. Lớp xác thực và phân quyền

- JWT Bearer token
- `JwtAuthGuard`
- `RolesGuard`
- ownership check theo `req.user.sub`

3. Lớp bảo vệ dữ liệu

- masking dữ liệu khi trả về API
- mã hóa AES-GCM cho dữ liệu nhạy cảm trong Oracle
- mô hình DEK theo user, KEK dẫn xuất từ password

### 3.2 Dòng chảy dữ liệu

```text
Front-end
  -> HTTPS / reverse proxy
  -> envelope transport (RSA key exchange + AES-GCM)
  -> NestJS backend
  -> JWT guard + role guard + ownership check
  -> decrypt/mask theo user
  -> Oracle
```

## 4. Tổ chức bảo mật ở front-end

### 4.1 Bảo mật đường truyền ứng dụng

Front-end không gửi payload plaintext nếu transport crypto đang bật.

Luồng chính ở front-end:

- lấy public key từ backend qua `/api/transport/public-key`
- sinh một AES session key ngẫu nhiên 32 bytes
- mã hóa session key bằng RSA-OAEP
- nếu request là JSON, mã hóa payload bằng AES-GCM với AAD
- gửi lên backend qua các header:
  - `X-App-Envelope: 1`
  - `X-App-Timestamp`
  - `X-App-Nonce`
  - `X-App-Session-Key`

File liên quan:

- [frontend/src/api/client.ts](../frontend/src/api/client.ts)
- [frontend/src/api/transportEnvelope.ts](../frontend/src/api/transportEnvelope.ts)

### 4.2 Vai trò của front-end masking

Front-end không phải nơi quyết định quyền xem dữ liệu nhạy cảm.

Nó chỉ:

- hiển thị kết quả đã được backend mask
- giải mã response envelope nếu backend trả envelope

Quyền thật sự vẫn do backend quyết định.

## 5. Bảo mật ở tầng truyền tải

### 5.1 HTTPS tại reverse proxy

Project có nginx reverse proxy terminate TLS:

- HTTP redirect sang HTTPS
- TLS 1.2/1.3
- HSTS bật

File liên quan:

- [nginx-proxy/conf.d/default.conf](../nginx-proxy/conf.d/default.conf)

### 5.2 Application-layer envelope

Đây là lớp bảo mật bổ sung trên HTTPS.

Luồng:

1. Front-end gọi `/api/transport/public-key` để lấy thông tin public key RSA.
2. Front-end sinh AES session key ngẫu nhiên.
3. Session key được RSA-OAEP encrypt bằng public key backend.
4. Backend dùng private key RSA để decrypt session key.
5. Body request và response được mã hóa bằng AES-GCM.
6. AAD gồm `METHOD|PATH|TIMESTAMP|NONCE` để chống sửa đổi payload.

Backend sử dụng:

- [backend/src/crypto/services/rsa-transport.service.ts](../backend/src/crypto/services/rsa-transport.service.ts)
- [backend/src/crypto/interceptors/transport-envelope.interceptor.ts](../backend/src/crypto/interceptors/transport-envelope.interceptor.ts)

### 5.3 Khi nào RSA còn quan trọng

RSA vẫn quan trọng vì:

- nó là điểm khởi đầu để trao đổi session key an toàn
- nếu không có RSA, front-end không thể bootstrap AES session key theo mô hình hiện tại
- nó bảo vệ lớp transport application-level khỏi việc phải gửi khóa AES trực tiếp

Nhưng:

- RSA không dùng để mã hóa dữ liệu nghiệp vụ lớn
- RSA không thay thế cơ chế DEK/KEK tại rest

## 6. Bảo mật ở backend

### 6.1 Xác thực và phân quyền

Backend dùng:

- JWT Bearer token: [backend/src/modules/auth/strategies/jwt.strategy.ts](../backend/src/modules/auth/strategies/jwt.strategy.ts)
- `JwtAuthGuard`: [backend/src/common/guards/jwt-auth.guard.ts](../backend/src/common/guards/jwt-auth.guard.ts)
- `RolesGuard`: [backend/src/common/guards/roles.guard.ts](../backend/src/common/guards/roles.guard.ts)

Luồng:

1. User đăng nhập thành công.
2. Backend phát JWT chứa `sub`, `username`, `role`.
3. Request sau đó phải mang Bearer token.
4. Guard kiểm tra token và role trước khi vào controller.

### 6.2 Ownership check

Đây là lớp quan trọng nhất để đảm bảo user chỉ xem dữ liệu của chính mình.

Nguyên tắc:

- `req.user.sub` là identity thật của user
- controller không nhận userId từ client để quyết định quyền
- service tự map `userId -> customerId -> account/card/...`
- mọi truy cập dữ liệu nhạy cảm đều kiểm tra ownership trong backend

Các ví dụ:

- customer profile: [backend/src/modules/customers/customers.controller.ts](../backend/src/modules/customers/customers.controller.ts)
- accounts của tôi: [backend/src/modules/accounts/accounts.controller.ts](../backend/src/modules/accounts/accounts.controller.ts)
- giao dịch của tôi: [backend/src/modules/transactions/transactions.controller.ts](../backend/src/modules/transactions/transactions.controller.ts)
- thẻ của tôi: [backend/src/modules/cards/cards.controller.ts](../backend/src/modules/cards/cards.controller.ts)

## 7. Mô hình mặt nạ dữ liệu

### 7.1 Khi nào mask

Backend mask dữ liệu khi:

- user chưa xác thực PIN
- role là admin nhưng không được phép xem chi tiết dữ liệu nhạy cảm
- dữ liệu được trả về danh sách tổng quan thay vì chi tiết

### 7.2 Cơ chế mask

Masking engine quyết định cách che theo field và role.

File liên quan:

- [backend/src/masking/masking.engine.ts](../backend/src/masking/masking.engine.ts)

Điểm chính:

- customer chưa PIN: chỉ thấy dữ liệu che một phần
- customer đã PIN: được xem full dữ liệu của chính mình
- admin: nhiều trường bị mask toàn phần hoặc chặn xem chi tiết

### 7.3 Ý nghĩa đối với đề tài

Đây là phần đáp ứng trực tiếp yêu cầu “quản lý dữ liệu an toàn dưới dạng mặt nạ dữ liệu trên ORACLE”.

Hệ thống không chỉ lưu an toàn, mà còn kiểm soát mức độ hiển thị theo ngữ cảnh truy cập.

## 8. Mô hình khóa DEK/KEK

### 8.1 DEK là gì

DEK là khóa mã hóa dữ liệu.

Trong project:

- mỗi user customer có DEK riêng
- DEK dùng để mã hóa phone, CCCD, date of birth, address, account number, balance
- DEK không lưu thô trong DB

### 8.2 KEK là gì

KEK là khóa bọc DEK.

Trong project:

- KEK được dẫn xuất từ password + salt + iterations bằng PBKDF2-SHA256
- KEK chỉ dùng để wrap/unwrap DEK
- KEK không dùng trực tiếp để mã hóa dữ liệu nghiệp vụ

File liên quan:

- [backend/src/crypto/services/user-key-derivation.service.ts](../backend/src/crypto/services/user-key-derivation.service.ts)
- [backend/src/modules/auth/auth.service.ts](../backend/src/modules/auth/auth.service.ts)

### 8.3 Metadata khóa

Mỗi user có metadata riêng trong `USER_KEY_METADATA`:

- `KDF_ALGO`
- `KDF_ITERATIONS`
- `KDF_SALT_HEX`
- `WRAPPED_DEK_B64`
- `RECOVERY_WRAPPED_DEK_B64`
- `PASSWORD_EPOCH`

File liên quan:

- [backend/src/modules/auth/entities/user-key-metadata.entity.ts](../backend/src/modules/auth/entities/user-key-metadata.entity.ts)
- [backend/sql/08_user_key_metadata.sql](../backend/sql/08_user_key_metadata.sql)
- [backend/sql/09_key_recovery_wrap.sql](../backend/sql/09_key_recovery_wrap.sql)

## 9. Luồng đăng ký

### 9.1 Mục tiêu

Tạo user mới, tạo DEK mới, mã hóa dữ liệu nhạy cảm, lưu metadata khóa.

### 9.2 Các bước

1. Kiểm tra username/email trùng trong bảng `USERS`.
2. Kiểm tra phone/cccd trùng bằng cách giải mã customer hiện có.
3. Kiểm tra account number bằng hash lookup.
4. Băm password bằng PBKDF2.
5. Tạo user record.
6. Tạo DEK mới và wrap DEK bằng password.
7. Lưu metadata khóa.
8. Mã hóa phone, CCCD, DOB, address, account number, balance bằng DEK user.
9. Ghi audit.

### 9.3 Vì sao `findOne` tìm được email

Trong code hiện tại, email ở `USERS` và `CUSTOMERS` là plaintext, không phải encrypted.

Do đó `findOne({ email: dto.email })` vẫn hoạt động bình thường.

### 9.4 Có nên mã hóa email không

Nên, nếu mục tiêu là tăng mức bảo mật dữ liệu cá nhân và giảm rủi ro khi lộ DB hoặc khi admin xem danh sách người dùng.

Khuyến nghị thiết kế:

- lưu email ở dạng mã hóa để chỉ backend giải mã được khi cần hiển thị cho đúng chủ sở hữu
- thêm cột `emailHashed` để tra cứu, kiểm tra trùng và hỗ trợ login / forgot-password
- nên dùng hash có khóa bí mật như HMAC-SHA256 thay vì hash thuần, để giảm nguy cơ dò ngược

Ý nghĩa thực tế:

- `emailHashed` dùng cho `findOne` và unique check
- `emailEncrypted` dùng khi cần trả email cho chính chủ
- masking vẫn cần giữ nguyên, vì mã hóa tại rest không thay thế quyền xem theo vai trò

Lưu ý:

- nếu email vẫn cần dùng thường xuyên cho thông báo, OTP, hoặc tra cứu nghiệp vụ, thì chỉ mã hóa email thôi là chưa đủ; phải đồng thời có cột tra cứu riêng
- nếu chỉ thêm `emailHashed` mà không mã hóa email, DB vẫn còn email plaintext, khi đó chỉ cải thiện tìm kiếm chứ chưa cải thiện privacy đầy đủ

## 10. Luồng đăng nhập

### 10.1 Mục tiêu

Xác thực password, nạp DEK runtime nếu là customer.

### 10.2 Các bước

1. Tìm user theo username.
2. Verify password hash.
3. Nếu là customer, gọi `ensureUserDekRuntime(...)`.
4. Unwrap DEK từ metadata bằng password.
5. Nạp DEK vào runtime cache.
6. Phát JWT.

### 10.3 Ý nghĩa

User login thành công thì backend mới có khóa để giải mã dữ liệu của user đó.

## 11. Luồng xem dữ liệu của user

### 11.1 Chưa nhập PIN

Trạng thái này áp dụng khi user chỉ vừa đăng nhập, chưa mở session PIN.

Luồng:

1. User gọi `GET /customers/me`.
2. Backend lấy `customerId` từ `req.user.sub`.
3. `getProfile(...)` kiểm tra ownership.
4. Nếu chưa có `viewToken` hợp lệ, `pinMode = false`.
5. Dữ liệu trả về được mask.

Kết quả:

- phone, cccd, email, address, DOB hiển thị dạng che
- user vẫn xem được thông tin cơ bản, nhưng không thấy full chi tiết

### 11.2 Đã nhập PIN đúng

Luồng:

1. User gọi `POST /customers/me/verify-pin`.
2. Backend kiểm tra PIN hash.
3. Nếu đúng, tạo `viewToken` có TTL ngắn.
4. User gọi lại `GET /customers/me?viewToken=...`.
5. `isPinVerified = true`.
6. Masking engine trả full dữ liệu cho chính user đó.

### 11.3 Điểm then chốt

- không có PIN đúng thì không có viewToken hợp lệ
- không có ownership thì không được decrypt dữ liệu
- admin không có cơ chế chuyển sang trạng thái full view

## 12. Luồng đổi mật khẩu

### 12.1 Mục tiêu

Đổi password nhưng không làm mất dữ liệu đã mã hóa.

### 12.2 Cơ chế

1. Xác thực current password.
2. Lấy DEK hiện tại.
3. Sinh salt mới.
4. Dẫn xuất KEK mới từ password mới.
5. Wrap lại đúng DEK cũ bằng KEK mới.
6. Cập nhật `PASSWORD_HASH`.

### 12.3 Vì sao dữ liệu không mất

Bởi vì dữ liệu nghiệp vụ không phụ thuộc trực tiếp vào password.

Cấu trúc là:

```text
Password -> KEK -> wrap DEK -> DEK mã hóa dữ liệu
```

Khi đổi password, chỉ lớp `Password -> KEK` đổi. DEK và dữ liệu bên dưới không đổi.

## 13. Luồng quên mật khẩu

### 13.1 Mục tiêu

Khôi phục quyền truy cập khi user quên password mà không phá dữ liệu cũ.

### 13.2 Hai bước

1. Request OTP qua email.
2. Confirm OTP + new password.

### 13.3 Cơ chế dữ liệu

Sau khi OTP đúng:

1. Backend thử unwrap DEK bằng `DEK_RECOVERY_KEY`.
2. Nếu unwrap được, wrap lại DEK bằng password mới.
3. Nếu không unwrap được, fallback tạo DEK mới và log sự kiện fallback.

### 13.4 Ý nghĩa

Quên mật khẩu không cần xóa toàn bộ dữ liệu.

Chỉ cần khôi phục hoặc tái tạo lớp khóa bên ngoài.

## 14. Vì sao admin không xem được về mặt chức năng

### 14.1 Cách khóa chức năng

- API admin không có endpoint trả chi tiết nhạy cảm.
- endpoint xem chi tiết customer bị chặn cứng.
- danh sách admin chỉ trả dữ liệu masked.
- các thao tác nhạy cảm phải qua PIN admin nhưng vẫn không mở full view.

### 14.2 Đây là policy của hệ thống, không phải chỉ là UI

Chính sách này nằm ở backend, nên nếu admin dùng client khác vẫn bị backend chặn.

## 15. Đánh giá mức độ đáp ứng yêu cầu đề tài

### 15.1 Yêu cầu: quản lý dữ liệu an toàn

Đáp ứng tốt.

Lý do:

- dữ liệu nhạy cảm được mã hóa trước khi lưu Oracle
- password/PIN không lưu plaintext
- account number có hash lookup riêng
- có audit log

### 15.2 Yêu cầu: mặt nạ dữ liệu

Đáp ứng tốt.

Lý do:

- masking engine phân biệt customer/admin
- customer chưa PIN chỉ thấy dữ liệu che
- customer đã PIN xem được dữ liệu của chính mình
- admin không có full-view chi tiết

### 15.3 Yêu cầu: trên ORACLE

Đáp ứng tốt.

Lý do:

- các entity và migration đang dùng Oracle
- dữ liệu nhạy cảm được lưu trong các cột blob/clob/hashed field
- có script schema và migration cho key metadata

### 15.4 Yêu cầu: bằng TypeScript

Đáp ứng tốt.

Lý do:

- toàn bộ backend chính dùng NestJS/TypeScript
- front-end dùng TypeScript + Vite/React

### 15.5 Đánh giá tổng thể cho đề tài

Project này **đáp ứng khá đầy đủ** mục tiêu đề tài và có kiến trúc tốt hơn mức tối thiểu của một bài quản lý dữ liệu có mask đơn thuần.

Điểm mạnh nổi bật:

- có phân tầng rõ giữa transport, auth, masking, encryption
- có mô hình DEK/KEK đúng hướng
- có quy trình đổi mật khẩu mà không mất dữ liệu
- có cơ chế quên mật khẩu dựa trên recovery key
- có kiểm soát xem dữ liệu theo user/PIN

Điểm cần lưu ý nếu chấm theo hướng an ninh thực tế:

- secret đang phải quản lý cực kỳ cẩn thận
- session PIN và replay cache hiện còn dùng memory
- danh sách admin bị mask nhiều hơn là một cơ chế “xem chi tiết có kiểm soát”

## 16. Kết luận

Nếu xét theo bài toán học thuật “quản lý dữ liệu an toàn dưới dạng mặt nạ dữ liệu trên ORACLE bằng TypeScript”, project này đạt yêu cầu cốt lõi và còn vượt một phần yêu cầu nhờ:

- mã hóa dữ liệu ở mức ứng dụng
- masking theo vai trò
- ownership check
- cơ chế DEK/KEK
- hỗ trợ đổi mật khẩu và quên mật khẩu mà không mất dữ liệu

RSA vẫn quan trọng vì nó là lớp bootstrap cho transport encryption. Tuy nhiên, giá trị lớn nhất của hệ thống vẫn nằm ở mô hình DEK/KEK và masking trên backend.
