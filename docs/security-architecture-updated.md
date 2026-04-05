# Security Architecture (Updated)

Sơ đồ ngắn gọn theo luồng bảo mật thực tế của hệ thống.

## PlantUML

```plantuml
@startuml
left to right direction
skinparam backgroundColor white
skinparam packageStyle rectangle
skinparam shadowing false
skinparam defaultTextAlignment center

actor Client as C
rectangle "Client" as CLIENT
rectangle "Server" as SERVER
database "Oracle Database" as DB

CLIENT --> SERVER : Mã hóa RSA-OAEP + AES-GCM\n(kèm AAD, chống replay)
SERVER --> CLIENT : Giải mã RSA+AES, xử lý nghiệp vụ\nphản hồi AES-GCM (fail-hard nếu lỗi giải mã)

SERVER --> DB : Mã hóa AES-GCM dữ liệu nhạy cảm\nPBKDF2 dẫn xuất KEK để wrap DEK\nBăm HMAC-SHA256 cho tra cứu email
DB --> SERVER : Trả dữ liệu đã mã hóa\nServer giải mã AES-GCM và masking trước khi trả về

@enduml
```

## Mermaid

```mermaid
flowchart LR
    C[Client]
    S[Server]
    DB[(Oracle Database)]

    C -->|Mã hóa RSA-OAEP + AES-GCM\n(kèm AAD, chống replay)| S
    S -->|Giải mã RSA+AES, xử lý nghiệp vụ\nPhản hồi AES-GCM| C
    S -->|Mã hóa AES-GCM dữ liệu nhạy cảm\nPBKDF2 dẫn xuất KEK để wrap DEK\nBăm HMAC-SHA256 cho lookup email| DB
    DB -->|Trả dữ liệu đã mã hóa\nServer giải mã AES-GCM + masking| S
```

## Tóm tắt ngắn

- Client -> Server: Mã hóa RSA-OAEP + AES-GCM (AAD, chống replay).
- Server -> DB: Mã hóa AES-GCM cho dữ liệu nhạy cảm; PBKDF2 để dẫn xuất KEK và wrap DEK.
- DB -> Server -> Client: Server giải mã AES-GCM, áp dụng masking, rồi phản hồi dữ liệu bảo vệ bằng AES-GCM.
