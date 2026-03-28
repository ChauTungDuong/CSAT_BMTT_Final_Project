# Backend Setup

This backend supports two Oracle connection modes:

- cloud (default): connect to Oracle Cloud with wallet
- local: connect to local Oracle container fallback

## 1) Environment

Copy template and configure values:

```bash
cp .env.example .env
```

Important variables:

- DB_CONNECTION_MODE=cloud|local
- DB_USER
- DB_PASSWORD
- TNS_NAME (cloud)
- WALLET_PATH (cloud)
- WALLET_PASSWORD (cloud)
- DB_HOST, DB_PORT, DB_SERVICE (local fallback)
- JWT_SECRET
- AES_MASTER_KEY
- HMAC_SECRET

## 2) Run App

```bash
npm install
npm run build
npm run start:prod
```

## 3) Database Scripts

Cloud-first scripts:

```bash
npm run db:cloud:reset-migrate-seed
npm run db:migrate:cloud
npm run db:seed:customers
npm run db:fix-passwords
```

Local fallback scripts:

```bash
npm run db:local:reset-migrate-seed
npm run db:migrate:docker
npm run db:seed:customers:local
npm run db:fix-passwords:local
```

Optional flags:

```bash
node scripts/reset-migrate-seed.js --mode=cloud --migrate-only
node scripts/reset-migrate-seed.js --mode=cloud --no-seed
```

## 4) Docker Notes

- Backend container expects wallet mounted read-only at `/app/wallet` (or the path you set with `WALLET_PATH`).
- In docker compose, Oracle local is disabled by default and available only with `--profile localdb`.

## 5) Linux Deployment

See top-level deployment runbook:

- `DEPLOY_LINUX.md`
