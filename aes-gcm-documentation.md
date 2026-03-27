# Tài Liệu Kỹ Thuật: Triển Khai AES-GCM Thuần TypeScript (Pure TS)

Tài liệu này giải thích chi tiết cách hệ thống mã hóa AES-256-GCM được triển khai từ đầu (from scratch) bằng TypeScript thuần túy mà không phụ thuộc vào thư viện lõi native C++ (như `crypto.createCipheriv` của Node.js). 

Mã nguồn được tổ chức trong thư mục: `src/crypto/aes-gcm/`

---

## 1. Mối Liên Hệ Giữa Các Thành Phần

Dự án tái cấu trúc AES-GCM thành 3 phần rõ rệt, tượng trưng cho 3 khái niệm toán học và mật mã khác nhau:

- **[aes-core.ts](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/aes-core.ts) (Khối Block Cipher Bản Lề):** Chỉ chứa thuật toán mã hóa 1 khối văn bản (16 bytes) độc lập bằng cách sử dụng thuật toán Rijndael (AES).
- **[ghash.ts](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/ghash.ts) (Cơ Chế Xác Thực - Authentication):** Tính toán mã xác thực (MAC) bằng các phép nhân đa thức trên trường hữu hạn Galois `GF(2^128)`.
- **[gcm.ts](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/gcm.ts) (Chế Độ Hoạt Động GCM):** Trình bao bọc kết hợp AES-Core thành bộ đếm (CTR mode) để mã hóa luồng dữ liệu dài, và kết hợp bằng GHASH để cấp thuộc tính Authenticated Encryption.

---

## 2. Giải Phẫu Chức Năng Của Từng Tệp

### 2.1. [aes-core.ts](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/aes-core.ts) (Thuật Toán Lõi AES)
**Nhiệm vụ:** Mã hóa bản rõ 16-byte thành bản mã 16-byte bằng Khóa (Key). Không hỗ trợ giải mã ngược vì GCM không cần.

#### Các Hằng Số Quan Trọng:
1.  **`SBOX` (Substitution Box):** Là một mảng tĩnh chứa 256 giá trị thay thế. Đây là thành phần cung cấp tính "phi tuyến tính" (non-linearity) duy nhất cho AES, bảo vệ nó trước các cuộc tấn công đại số (Algebraic Attacks). Nó là toán học đảo nghịch trong trường Galois kết hợp biến đổi Affine.
2.  **`RCON` (Round Constant):** Mảng hằng số vòng, tránh việc tạo ra sự đối xứng trong quá trình sinh khóa phụ (Key Expansion).

#### Các Hàm Chính:
*   **[expandKey256(key)](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/aes-core.ts#29-51)**: Lấy [Key](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/aes-core.ts#29-51) tĩnh 32 bytes (256 bits) ban đầu và mở rộng thành 60 words (tương đương 15 "Round Keys" dài 16 byte). Mỗi vòng mã hóa sẽ xài một Round Key khác nhau.
*   **[encryptBlock(state, expandedKey)](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/aes-core.ts#76-131)**: Nhận vào văn bản `state` (16 bytes) và làm biến đổi qua 14 Vòng (Rounds) với các thao tác cơ bản:
    *   `SubBytes()`: Thay thế từng byte bằng SBOX.
    *   `ShiftRows()`: Dịch trái số thứ tự các byte theo hàng ma trận nhằm xáo trộn vị trí.
    *   `MixColumns()`: Trộn các cột với nhau bằng phép nhân ma trận trên trường `GF(2^8)`. Rất phức tạp nên đã được tối ưu hóa thành hàm chạy mảng bitwise trong code.
    *   `AddRoundKey()`: XOR vị trí bằng Round Key hiện tại.

### 2.2. [ghash.ts](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/ghash.ts) (Trường Hữu Hạn Galois)
**Nhiệm vụ:** Đây là "bộ não" bảo vệ hệ thống trước hành vi sửa đổi dữ liệu (Tampering). Thay vì dùng HMAC-SHA256 nặng nề chập chạp, GCM dùng GHASH vì tốc độ nhân bit cực nhanh trên vi xử lý.

#### Các Cơ Chế Chính:
1.  **[gf128Multiply(x, y)](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/ghash.ts#3-53)**: Phép nhân 2 khối Block (16 byte) trong **Galois Field `GF(2^128)`**. 
    *   Trong số học thông thường, $1+1=2$. Còn trong trường này, mọi phép CỘNG (Add) được thiết kế thành phép XOR (Nên $1+1=0$). 
    *   Đa thức tối giản (Irreducible Polynomial) được dùng để giới hạn kết quả không bao giờ vượt qua biên 16-byte là $x^{128} + x^7 + x^2 + x + 1$ (Trong code là Hằng số tĩnh ma thuật `0xE1000000` do biểu diễn đảo chiều bit Big-Endian).
2.  **[ghash(H, AAD, Ciphertext)](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/ghash.ts#54-121)**: Liên tục nhồi thông tin của Authentication Data (như thông tin Headers không mã hóa) và Ciphertext (Dữ liệu đã mã hóa) vào một bộ đệm Accumulator, nhân liên tục với Khóa Chứng Thực `H`.

### 2.3. [gcm.ts](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/gcm.ts) (Chế Độ GCM & CTR)
**Nhiệm vụ:** Ráp nối `AES-Core` và `GHASH` để tạo luồng API public mã hóa / giải mã.

#### Các Bước Mã Hóa (Encrypt):
1.  Tạo Khóa Băm H: Lấy 16 byte toàn con số 0 (`0^128`) bỏ vào hàm mã hóa AES: `H = E(K, 0)`.
2.  Thiết lập Counter Block (J0): Tạo bộ đếm bằng IV ghép số `1`: `J0 = IV || 0^31 || 1`. J0 không dùng mã hóa data mà dùng để tạo Auth Tag.
3.  Tăng Counter ([inc32](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/gcm.ts#6-17)): Bắt đầu biến đếm khối thật sự $CB1 = J0 + 1$.
4.  Mã hóa CTR Mode: Với mỗi cục 16 byte văn bản (Plaintext), không bỏ Plaintext vào AES nữa. Thay vào đó, đem biến đếm $CB_i$ vào AES, rồi lấy kết quả đem XOR với Plaintext. Việc XOR này tạo ra Payload tốc độ cực đại (Streaming).
5.  Tính Auth Tag: Nén toàn bộ Payload đã mã qua [ghash()](file:///d:/CSAT_Final_Project/backend/src/crypto/aes-gcm/ghash.ts#54-121). Sau đó đem kết quả đó XOR với lần mã hóa tại $J0$.

#### Các Bước Giải Mã (Decrypt):
*   Quá trình giải mã GCM hoàn toàn **không cần hàm Giải mã AES**!
*   Quy tăc vật lý: `X XOR Y = Z`, nên `Z XOR Y = X`.
*   Vì lúc mã hóa ta làm: `Cipher = Plain XOR E(K, Counter)`. 
*   Lúc giải mã chỉ cần lấy lại: `Plain = Cipher XOR E(K, Counter)`.
*   Vì AES mã hóa Counter (bản thân nó luôn quay theo mốc tiến) hoàn toàn không phụ thuộc vào data.

---

## 3. Tại Sao Thay Đổi Lại An Toàn? (Kết Luận)
Dù chúng ta sử dụng `Aes-GCM` tự lập trình, kết quả hàm sinh ra `Ciphertext` và `AuthTag` hoàn toàn **khớp đồng vị 100% đến từng bit** khi đem đi so sánh Assert Unit Test bằng Jest với thư viện mã C++ thuần túy của Nodejs. Việc code GCM bằng TypeScript cung cấp hiểu biết siêu chi tiết vào vi kiến trúc Mật Mã Học hiện đại, mở ra cách phòng thủ và đánh giá Timing Attacks.
