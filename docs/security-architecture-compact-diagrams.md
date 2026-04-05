# Sơ đồ kiến trúc bảo mật (ngắn gọn)

Mục tiêu: sơ đồ khái quát luồng Client -> Server -> DB, chỉ nêu thuật toán/cơ chế chính giữa các thành phần.

## PlantUML

```plantuml
@startuml
left to right direction
skinparam shadowing false
skinparam packageStyle rectangle

actor Client as C
rectangle "Backend Server" as S
database "Oracle DB" as D

C --> S : RSA-OAEP + AES-256-GCM\nAAD + nonce/timestamp (anti-replay)
S --> C : AES-256-GCM envelope\nstrict + fail-hard khi decrypt lỗi

S --> D : AES-256-GCM (field-level, per-user DEK)\nPBKDF2-HMAC-SHA256 (derive KEK/wrap DEK)\nHMAC-SHA256 (hash lookup/unique)
D --> S : Encrypted cells + hash indexes
@enduml
```

## Mermaid

```mermaid
flowchart LR
    C[Client]
    S[Backend Server]
    D[(Oracle DB)]

    C -->|RSA-OAEP + AES-256-GCM\nAAD + nonce/timestamp anti-replay| S
    S -->|AES-256-GCM envelope\nstrict + fail-hard decrypt| C

    S -->|AES-256-GCM field-level + per-user DEK\nPBKDF2 derive KEK / wrap DEK\nHMAC-SHA256 hash lookup| D
    D -->|encrypted cells + hash indexes| S
```

## Gợi ý phần giải thích ngay dưới sơ đồ

- Client <-> Server: hybrid encryption cho transport (RSA-OAEP bọc session key, AES-GCM mã hóa payload).
- Server <-> DB: mã hóa dữ liệu nhạy cảm theo user key; dùng PBKDF2 cho vòng đời key và HMAC cho tra cứu/unique.
- Authorization: JWT + single-session sid + kiểm tra ownership để mỗi user chỉ xem dữ liệu của chính mình.
