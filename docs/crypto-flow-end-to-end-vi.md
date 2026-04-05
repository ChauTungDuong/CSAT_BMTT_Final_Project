# Luồng hoạt động thuật toán mã hóa/dẫn xuất/mask (Frontend <-> Backend)

Tài liệu này mô tả chi tiết các luồng thực thi bảo mật trong hệ thống theo hướng end-to-end: từ frontend gửi request, backend xử lý, truy cập DB, rồi phản hồi ngược lại frontend.

## 1. Thành phần và thuật toán chính

- Frontend:
  - `frontend/src/api/client.ts`: Axios interceptor cho request/response, ép strict transport, fail-hard với response nhạy cảm.
  - `frontend/src/api/transportEnvelope.ts`: tạo envelope mã hóa, RSA-OAEP encrypt session key, AES-GCM encrypt/decrypt payload, nonce/timestamp/AAD.
- Backend:
  - `backend/src/crypto/interceptors/transport-envelope.interceptor.ts`: giải mã request envelope, chống replay, mã hóa response envelope.
  - `backend/src/crypto/services/rsa-transport.service.ts`: xử lý RSA-OAEP và AES-GCM ở tầng transport.
  - `backend/src/crypto/services/aes.service.ts`: mã hóa/giải mã dữ liệu nhạy cảm theo `user DEK`.
  - `backend/src/crypto/services/user-key-derivation.service.ts` + `backend/src/crypto/services/pbkdf2.service.ts`: dẫn xuất KEK từ mật khẩu bằng PBKDF2-HMAC-SHA256.
  - `backend/src/crypto/services/user-key-metadata.service.ts`: lưu metadata KDF và wrapped DEK.
  - `backend/src/crypto/services/user-dek-runtime.service.ts`: cache DEK runtime theo user.
  - `backend/src/masking/masking.engine.ts`: mask dữ liệu theo role và trạng thái PIN.

Thuật toán/cơ chế sử dụng:

- RSA-OAEP (manual): bọc AES session key giữa client-server.
- AES-256-GCM (manual + WebCrypto): mã hóa payload transport và field nhạy cảm trong DB.
- PBKDF2-HMAC-SHA256: dẫn xuất KEK từ mật khẩu.
- HMAC-SHA256: hash lookup/unique (email, account number, phone, cccd).
- Anti-replay: nonce + timestamp + AAD(method|path|timestamp|nonce).
- Single-session: `sid` + `SessionRegistryService`.

## 2. Luồng transport: Frontend -> Backend (request)

### Bước 1: Frontend kiểm tra có cần bật envelope

Trong `client.ts`, request interceptor:

- Xác định request có body JSON hay không.
- Nếu strict transport bật và không thể mã hóa, request bị chặn.
- Gọi `prepareEnvelopeRequest(...)` để tạo metadata và body mã hóa.

### Bước 2: Frontend tạo gói mã hóa

Trong `transportEnvelope.ts`:

- Lấy public key qua `/api/transport/public-key` (cache theo TTL).
- Sinh `sessionKey` 32 bytes (AES-256).
- Mã hóa sessionKey bằng RSA-OAEP.
- Tạo `timestamp`, `nonce` và `aad = METHOD|PATH|TIMESTAMP|NONCE`.
- Nếu có body JSON, mã hóa body bằng AES-GCM với AAD.
- Gắn headers:
  - `X-App-Envelope: 1`
  - `X-App-Timestamp`
  - `X-App-Nonce`
  - `X-App-Session-Key`

### Bước 3: Backend nhận request và kiểm tra an toàn

Trong `TransportEnvelopeInterceptor`:

- Kiểm tra strict mode và bắt buộc metadata nếu request ở envelope mode.
- Validate timestamp theo `APP_LAYER_CRYPTO_MAX_SKEW_MS`.
- Kiểm tra replay bằng map nonce/timestamp (`assertNonceFresh`).
- Dựng lại AAD từ method/path/timestamp/nonce.
- Giải mã session key bằng RSA private key.
- Giải mã body AES-GCM theo AAD và thay thế `req.body` plaintext JSON.

## 3. Luồng xử lý dữ liệu nhạy cảm trong Backend/DB

### 3.1 Thiết lập user context và DEK runtime

- `CryptoTraceInterceptor` nạp `userId` vào AsyncLocalStorage (`CryptoTraceContextService`).
- `AesService.encrypt/decrypt` yêu cầu có user context (không dùng master key fallback).
- DEK của user được lấy từ `UserDekRuntimeService`.

### 3.2 Quy trình tạo DEK/KEK

Trong `AuthService`:

- `initializeFreshUserDek(userId, password, migrationState)`:
  - Sinh DEK ngẫu nhiên 32 bytes.
  - Sinh salt KDF.
  - Dẫn xuất KEK từ password bằng PBKDF2.
  - Wrap DEK bằng KEK (AES-GCM) và lưu vào metadata.
  - Nạp DEK vào runtime cache.

- `ensureUserDekRuntime(userId, password)`:
  - Đọc metadata.
  - Dẫn xuất KEK từ mật khẩu hiện tại.
  - Unwrap DEK từ wrapped DEK để dùng trong phiên.

- `rewrapUserDek(...)` và `recoverAndRewrapUserDek(...)`:
  - Đổi mật khẩu/forgot password mà vẫn giữ DEK hiện có (rewrap với KEK mới).

### 3.3 Mã hóa field nhạy cảm ở DB

Trong `AesService.encryptForUser`:

- Lấy DEK runtime của user.
- AES-GCM encrypt với IV mới cho mỗi lần ghi.
- Lưu `CellValue` dạng encrypted (payload/iv/tag).

Trong `AesService.decryptForUser`:

- Lấy DEK đúng user.
- AES-GCM decrypt và verify auth tag.
- Sai tag -> trả null/lỗi theo ngữ cảnh.

## 4. Luồng mask dữ liệu trước khi trả về

Trong `MaskingEngine`:

- `mask(value, field, role, isPinVerified)` quyết định chiến lược mask theo role.
- Customer đã xác thực PIN có thể thấy nhiều field đầy đủ hơn.
- Admin vẫn bị giới hạn nhiều field nhạy cảm (CCCD, card, balance).

Ví dụ ở `CustomersService.getProfile`:

- Kiểm tra ownership: `customer.userId === viewerId`.
- Giải mã dữ liệu nhạy cảm.
- Áp mask theo role + pin mode trước khi trả JSON.

## 5. Luồng Backend -> Frontend (response)

### Bước 1: Backend mã hóa phản hồi

Trong `TransportEnvelopeInterceptor`:

- Set header `x-app-envelope: 1`.
- Nếu endpoint nhạy cảm, set thêm `x-app-sensitive: 1`.
- Serialize response JSON.
- Encrypt response bằng AES-GCM với cùng session key và AAD.

### Bước 2: Frontend giải mã phản hồi

Trong `client.ts` response interceptor:

- Đọc `x-app-envelope`.
- Nếu response nhạy cảm mà thiếu envelope hoặc thiếu AAD/session key -> fail.
- Gọi `decryptEnvelopeResponse(...)` để giải mã AES-GCM.
- Nếu decrypt fail ở endpoint nhạy cảm -> `forceSecurityLogout(...)` (fail-hard).

## 6. Luồng ràng buộc "mỗi user chỉ xem dữ liệu của chính mình"

Hệ thống thực thi đồng thời 3 lớp:

- Lớp truy cập API:
  - JWT validate trong `JwtStrategy.validate`.
  - Check `isActive`, `lockReason`, `sid` (single-session).

- Lớp ownership business:
  - Dịch vụ nghiệp vụ luôn kiểm tra quan hệ `userId -> customer/account` trước khi đọc/ghi.

- Lớp crypto keying:
  - Dữ liệu field-level mã hóa bằng DEK của đúng user.
  - Dùng sai user key không giải mã được payload.

## 7. Sequence tổng hợp (Mermaid)

```mermaid
sequenceDiagram
    participant FE as Frontend
    participant BE as Backend
    participant DB as Oracle DB

    FE->>BE: GET /transport/public-key
    BE-->>FE: RSA public key meta

    FE->>FE: Gen AES session key + nonce/timestamp + AAD
    FE->>BE: Request envelope (RSA(sessionKey) + AES-GCM(body))
    BE->>BE: Verify timestamp/nonce, anti-replay, decrypt envelope

    BE->>BE: JWT/sid/lock checks + ownership checks
    BE->>BE: Load DEK runtime (unwrap from metadata if needed)
    BE->>DB: Read/write encrypted fields (AES-GCM per-user DEK)
    DB-->>BE: Encrypted cells + hash lookup results

    BE->>BE: Decrypt fields (if needed) + MaskingEngine
    BE-->>FE: Response envelope AES-GCM (+ sensitive header)
    FE->>FE: Decrypt response; fail-hard nếu endpoint nhạy cảm decrypt lỗi
```

## 8. Ghi chú triển khai và ranh giới trách nhiệm

- Transport encryption và data-at-rest encryption là hai lớp độc lập, có thể hoạt động song song.
- PBKDF2 chỉ dùng cho dẫn xuất KEK/hash secret, không dùng trực tiếp mã hóa payload nghiệp vụ.
- HMAC hash phục vụ lookup/unique, không dùng để khôi phục plaintext.
- Masking chỉ là lớp hiển thị, không thay thế cho mã hóa.
