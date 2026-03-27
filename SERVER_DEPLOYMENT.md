# 🚀 Project Deployment & Setup Summary

**Last Updated**: March 26, 2026  
**Status**: ✅ Ready for Server Deployment  
**Port Configuration**: Frontend on 3002 (HTTPS)

---

## 📋 Quick Reference

### For First-Time Server Setup (After Git Pull)

```bash
# 1. Clone or pull code
git clone <REPO_URL> CSAT_Final_Project
cd CSAT_Final_Project
git pull origin main

# 2. Create .env file (VERY IMPORTANT!)
cp backend/.env.example backend/.env
# Edit backend/.env and set strong passwords

# 3. Create SSL certificates
mkdir -p backend/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Bank/CN=localhost"

# 4. Start all services
docker compose up -d --build

# 5. Wait for database (~120 seconds)
# 6. Access at https://localhost:3002 (or your server IP:3002)
```

---

## 🔧 Key Changes for Server Deployment

### Docker Compose Port Configuration (Updated)

| Service          | Old Ports       | ➜ New Ports     | Notes                     |
| ---------------- | --------------- | --------------- | ------------------------- |
| Frontend (Nginx) | 80:80, 443:443  | **3002:443**    | ✅ Primary entry point    |
| Backend (NestJS) | - (Docker only) | - (Docker only) | API server, internal only |
| Monitor          | 3001:80         | 3003:80         | Debugging tool (optional) |
| Database         | 1521:1521       | - (Docker only) | ❌ NOT exposed to server  |

**Access URLs**:

```
🌐 Frontend:    https://server-ip:3002
🔌 Backend API: http://bank-backend:3000  (internal Docker)
🛠️  Monitor:    http://server-ip:3003    (optional, if enabled)
❌ Database:    (Internal only)
```

---

## 📁 Files Structure & What to Push to GitHub

### ✅ SAFE to Push (Tracked in Git)

```
project/
├── src/                          ✅ SOURCE CODE
│   ├── backend/src/
│   ├── frontend/src/
│   └── monitor/src/
├── backend/
│   ├── sql/                      ✅ Migrations & seeds
│   │   ├── 01_schema.sql
│   │   ├── 02_seed.sql
│   │   ├── 03_redact.sql
│   │   └── 04_migrate_user_profile.sql
│   ├── scripts/                  ✅ Setup scripts
│   ├── package.json              ✅ Dependencies list
│   ├── .env.example              ✅ Template
│   ├── Dockerfile                ✅ Image definition
│   └── tsconfig.json             ✅ TypeScript config
├── frontend/
│   ├── package.json              ✅ Dependencies
│   ├── Dockerfile                ✅ Image definition
│   ├── nginx.conf                ✅ Nginx config
│   └── vite.config.ts            ✅ Build config
├── docker-compose.yml            ✅ Service orchestration
├── DEPLOYMENT_GUIDE.md           ✅ THIS FILE (deployment guide)
├── SETUP_GUIDE.md                ✅ Development setup
├── GIT_GUIDELINES.md             ✅ Git best practices
├── README.md                     ✅ Project overview
└── .gitignore                    ✅ Git rules
```

### ❌ NEVER Push (Ignored by .gitignore)

```
❌ backend/.env                  (SECRETS - generate on server)
❌ backend/ssl/                  (SSL keys - generate on server)
❌ node_modules/                 (too large - npm install locally)
❌ backend/dist/                 (compiled - npm run build locally)
❌ frontend/dist/                (compiled - npm run build locally)
❌ *.log                         (debug logs)
❌ .DS_Store, Thumbs.db          (OS files)
```

**Verify before push**:

```bash
git status              # Should be clean
git diff --cached       # Should not contain secrets
```

---

## 🔐 Security: Environment Variables

### backend/.env (Generate on Server Only)

```bash
# DO NOT COMMIT THIS FILE!
# Generate on server, keep secure

# Database
DB_HOST=oracle
DB_PORT=1521
DB_SERVICE=XEPDB1
DB_USER=smask_user
DB_PASSWORD=YourSecurePassword123  # ← Change this!

DB_ROOT_PASSWORD=YourRootPassword123  # ← Change this!

# Security - Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=<random-64-char-hex>     # ← Generate this!
AES_MASTER_KEY=<random-64-char-hex> # ← Generate this!
HMAC_SECRET=<random-64-char-hex>   # ← Generate this!

# App
PORT=3000
NODE_ENV=production
FRONTEND_URL=https://your-server-ip:3002
```

### SSL Certificate (Generate on Server Only)

```bash
# Run on server once:
mkdir -p backend/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Banking/CN=localhost"

# For production, use proper SSL (Let's Encrypt, etc.)
sudo certbot certonly --standalone -d your-domain.com
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem backend/ssl/cert.pem
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem backend/ssl/key.pem
```

---

## 📊 Database & Migrations

### Auto-Initialization (First Start)

When you run `docker compose up -d` for the first time:

1. ✅ Automatically creates schema from `backend/sql/01_schema.sql`
2. ✅ Automatically seeds data from `backend/sql/02_seed.sql`
3. ✅ Ready to use!

### Manual Migrations (if needed)

```bash
# Connect to database
docker exec -it oracle-xe sqlplus smask_user/App123456@XEPDB1

# Run specific migration
docker exec -i oracle-xe sqlplus smask_user/App123456!@XEPDB1 < backend/sql/03_redact.sql

# Seed additional data
docker exec -i oracle-xe sqlplus smask_user/App123456!@XEPDB1 < backend/sql/02_seed.sql
```

### Available SQL Files

| File                          | Purpose                             | Auto-run? |
| ----------------------------- | ----------------------------------- | --------- |
| `01_schema.sql`               | Create tables, indexes, constraints | ✅ Yes    |
| `02_seed.sql`                 | Insert sample data                  | ✅ Yes    |
| `03_redact.sql`               | Redact sensitive test data          | ❌ Manual |
| `04_migrate_user_profile.sql` | Migrate user profiles               | ❌ Manual |
| `fix_passwords.sql`           | Fix password issues                 | ❌ Manual |

---

## 🐳 Docker Commands

### Start Application

```bash
# Build + Start all services
docker compose up -d --build

# Start without rebuild
docker compose up -d

# View logs (all services)
docker compose logs -f

# View specific service logs
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f oracle
```

### Stop & Cleanup

```bash
# Stop all services (keep data)
docker compose stop

# Stop and remove containers (keep data)
docker compose down

# Remove everything including volumes (⚠️ loses data!)
docker compose down -v
```

### Health Checks

```bash
# Show container status
docker compose ps

# Check database health
docker compose exec -T oracle healthcheck.sh > /dev/null && echo "✅ DB OK" || echo "❌ DB Error"

# Check backend
docker compose exec -T backend curl -s http://localhost:3000/health

# Check logs for errors
docker compose logs backend | grep -i error
```

---

## 📝 Default Test Accounts

After first startup with seed data:

| Role         | Username    | Password          | Purpose                    |
| ------------ | ----------- | ----------------- | -------------------------- |
| **Admin**    | `admin`     | `Admin123456!`    | Dashboard, user management |
| **Customer** | `customer1` | `Customer123456!` | Banking features           |
| **Teller**   | `teller1`   | `Teller123456!`   | Counter services           |

> To use, login at: `https://your-server:3002`

---

## 🔍 Troubleshooting

### Issue: Cannot reach application on port 3002

**Check**:

```bash
# 1. Is frontend container running?
docker compose ps frontend  # Should be "Up"

# 2. Is port 3002 accessible?
netstat -tulpn | grep 3002
curl -k https://localhost:3002

# 3. Check frontend logs
docker compose logs frontend
```

**Fix**:

```bash
docker compose restart frontend
```

### Issue: Backend API not responding

**Check**:

```bash
# 1. Is backend running?
docker compose ps backend  # Should be "Up"

# 2. Can frontend reach it?
docker compose exec bank-frontend curl http://bank-backend:3000/health

# 3. Check backend logs
docker compose logs backend | tail -50
```

**Fix**:

```bash
docker compose restart backend
```

### Issue: Database connection timeout

**Check**:

```bash
# 1. Is database running?
docker compose ps oracle  # Should be "Up" and "healthy"

# 2. Wait for database startup (takes ~120s first time)
docker compose logs oracle | grep "Completed"
```

**Fix**:

```bash
# Database needs time to start
sleep 120
docker compose up -d backend frontend
```

### Issue: SSL Certificate error

**Check**:

```bash
# Does cert exist?
ls -la backend/ssl/cert.pem backend/ssl/key.pem
```

**Fix**:

```bash
# Regenerate certificate
rm -f backend/ssl/{cert.pem,key.pem}
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Bank/CN=localhost"
docker compose restart frontend
```

---

## 📚 Related Documentation

```
📖 DEPLOYMENT_GUIDE.md      ← Detailed deployment instructions (Tiếng Việt)
📖 SETUP_GUIDE.md           ← Development environment setup
📖 GIT_GUIDELINES.md        ← Git best practices & what to push
📖 GITIGNORE_STATUS.md      ← .gitignore verification
📖 README.md                ← Project overview
📖 INSTRUCTIONS.md          ← Project instructions
📖 aes-gcm-documentation.md ← Encryption details
```

---

## ✅ Deployment Checklist

Before deploying to server:

- [ ] Clone git repository
- [ ] Create `backend/.env` with strong passwords
- [ ] Generate SSL certificates in `backend/ssl/`
- [ ] Run `docker compose up -d --build`
- [ ] Wait ~2 minutes for database startup
- [ ] Access application at `https://server-ip:3002`
- [ ] Login with test account (admin/Admin123456!)
- [ ] Test basic features (login, view dashboard, etc.)
- [ ] Check logs for any errors: `docker compose logs`
- [ ] Setup monitoring/alerts if needed

---

## 🆘 Need Help?

1. **Check logs first**: `docker compose logs`
2. **Read DEPLOYMENT_GUIDE.md**: Detailed troubleshooting
3. **Review GIT_GUIDELINES.md**: Git best practices
4. **Contact team lead**: For deployment issues on server

---

**Status**: ✅ Ready for deployment  
**Next Step**: Follow the Quick Reference section above and DEPLOYMENT_GUIDE.md for detailed instructions

🎉 Happy Deploying!
