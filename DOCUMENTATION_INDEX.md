# 📚 Documentation Index

**CSAT Banking System - Complete Setup & Deployment Guide**

---

## 🎯 Choose Your Path

### 👨‍💻 I'm a Developer (Local Setup)

Start here: **[SETUP_GUIDE.md](SETUP_GUIDE.md)**

- Clone project
- Setup development environment
- Run locally with Docker
- Test with sample accounts

### 🖥️ I'm DevOps/Server Admin (Server Deployment)

Start here: **[SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md)**

- Quick reference for deployment
- Port configuration (3002 for frontend)
- Database migrations
- Troubleshooting checklist

### 📋 I Need Detailed Instructions

Read: **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**

- Complete step-by-step guide (Tiếng Việt)
- Port mapping explanation
- All database operations
- Comprehensive troubleshooting

### ⚡ I Need Quick Commands

Use: **[QUICK_COMMANDS.md](QUICK_COMMANDS.md)**

- Common Docker commands
- Database operations
- Troubleshooting snippets
- Copy-paste ready!

### 🔐 I'm Worried About Security

Read: **[GIT_GUIDELINES.md](GIT_GUIDELINES.md)**

- What NOT to push to GitHub
- Security checklist
- How to handle secrets
- .gitignore verification

---

## 📖 Documentation Files

| File                                         | Purpose                                    | For Whom           | Read Time |
| -------------------------------------------- | ------------------------------------------ | ------------------ | --------- |
| [SETUP_GUIDE.md](SETUP_GUIDE.md)             | Development environment setup              | Developers         | 15 min    |
| [SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md) | Server deployment quick reference          | DevOps/Admins      | 10 min    |
| [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)   | Detailed deployment instructions (Vietnam) | Everyone           | 30 min    |
| [QUICK_COMMANDS.md](QUICK_COMMANDS.md)       | Copy-paste ready commands                  | Quick reference    | 5 min     |
| [GIT_GUIDELINES.md](GIT_GUIDELINES.md)       | Git & GitHub best practices                | All developers     | 10 min    |
| [GITIGNORE_STATUS.md](GITIGNORE_STATUS.md)   | .gitignore verification                    | Security review    | 5 min     |
| [README.md](README.md)                       | Project overview                           | First time readers | 10 min    |

---

## 🚀 Quick Start (Copy-Paste)

### First Time Setup (After Git Clone)

```bash
# 1. Navigate to project
cd CSAT_Final_Project

# 2. Create environment file from template
cp backend/.env.example backend/.env

# 3. Edit .env and set strong passwords (use your own!)
# Edit: DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET, AES_MASTER_KEY, HMAC_SECRET

# 4. Generate SSL certificates
mkdir -p backend/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Banking/CN=localhost"

# 5. Start all services
docker compose up -d --build

# 6. Wait for database to initialize (~120 seconds)
sleep 120

# 7. Access application at:
# https://localhost:3002  (Dev)
# https://your-server-ip:3002  (Server)
```

### Access Application

```
🌐 Frontend:   https://localhost:3002
🔌 Backend API: http://localhost:3000  (Developer testing)
🛠️  Monitor:   http://localhost:3003  (Optional crypto tool)
```

### Login with Test Accounts

After startup, use these credentials:

```
👤 Admin User
   Username: admin
   Password: Admin123456!

👥 Customer User
   Username: customer1
   Password: Customer123456!

💼 Teller
   Username: teller1
   Password: Teller123456!
```

---

## 🔧 Key Changes for Server Deployment

### Port Configuration (Updated for Server)

```yaml
# Before (localhost only):
frontend:
  ports:
    - "80:80"
    - "443:443"

# After (server deployment):
frontend:
  ports:
    - "3002:443"     # ✅ NEW: Internal HTTPS on 3002

monitor:
  ports:
    - "3003:80"      # ✅ NEW: Monitor moved to 3003
```

### Access URLs

| Environment   | URL                    | Port |
| ------------- | ---------------------- | ---- |
| **Local Dev** | https://localhost:3002 | 3002 |
| **Server**    | https://server-ip:3002 | 3002 |
| **Monitor**   | http://server-ip:3003  | 3003 |

---

## 📁 What's Included

### Source Code & Config

```
✅ src/                    Source code (all modules)
✅ backend/sql/            Database schemas & migrations
✅ docker-compose.yml      Service orchestration
✅ Dockerfile              Container definitions
✅ nginx.conf              Web server config
✅ package.json            Dependencies
```

### Environment & Security

```
✅ backend/.env.example    Template (safe to commit)
❌ backend/.env            Secrets (never commit!)
❌ backend/ssl/            SSL keys (never commit!)
```

### Documentation

```
📖 README.md               Project overview
📖 SETUP_GUIDE.md          Dev setup guide
📖 SERVER_DEPLOYMENT.md    Server deployment guide
📖 DEPLOYMENT_GUIDE.md     Detailed instructions (VN)
📖 GIT_GUIDELINES.md       Git best practices
📖 QUICK_COMMANDS.md       Go-to command reference
```

---

## 🔒 Security Essentials

### Never Push These to GitHub

```bash
❌ backend/.env                  (database passwords)
❌ backend/ssl/key.pem          (private SSL key)
❌ backend/ssl/cert.pem         (SSL certificate)
❌ node_modules/                (too large)
❌ dist/ & build files          (generated)
❌ *.log files                  (debug logs)
```

**Verify before push**: `git status` should show clean

### Always Create These on Server

```bash
# 1. Generate strong passwords
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 2. Create backend/.env
cp backend/.env.example backend/.env
# Edit with your passwords!

# 3. Generate SSL certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Banking/CN=localhost"
```

---

## 🐳 Docker Services Architecture

```
┌─────────────────────────────────────────────────────┐
│                    USER BROWSER                      │
│              (HTTPS://:3002 or :3003)               │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌──────────────────┼──────────────────┐
    │                  │                  │
    ▼                  ▼                  ▼
┌─────────┐      ┌──────────┐      ┌─────────┐
│FRONTEND │      │ MONITOR  │      │ (UNUSED)│
│(Nginx)  │      │  (Dev)   │      │  (Dev)  │
│Port3002 │      │ Port3003 │      │         │
└────┬────┘      └────┬─────┘      └─────────┘
     │                │
     └────────┬───────┘
              │ (Docker Network)
              ▼
        ┌────────────┐
        │  BACKEND   │
        │ (NestJS)   │
        │ Port3000   │
        # (Internal) │
        └─────┬──────┘
              │
              ▼
        ┌────────────────┐
        │   DATABASE     │
        │  (Oracle XE)   │
        │ Port 1521      │
        │  (Internal)    │
        └────────────────┘
```

---

## ✅ Deployment Checklist

Before deploying to server:

```
PREPARATION
 ☐ Clone repository to server
 ☐ Install Docker & Docker Compose
 ☐ Verify ports 3002, 3003 not in use

CONFIGURATION
 ☐ Copy backend/.env.example → backend/.env
 ☐ Set strong passwords in backend/.env
 ☐ Generate SSL certificates
 ☐ Review docker-compose.yml port mappings

STARTUP
 ☐ Run: docker compose up -d --build
 ☐ Wait 2 minutes for database startup
 ☐ Monitor: docker compose logs

TESTING
 ☐ Access https://server:3002
 ☐ Login with admin account
 ☐ Test basic features
 ☐ Check for errors: docker compose logs

PRODUCTION
 ☐ Setup monitoring/alerting
 ☐ Configure backups
 ☐ Document deployment details
 ☐ Train team on operations
```

---

## 🆘 Troubleshooting Quick Links

| Problem                     | Solution                                                                      |
| --------------------------- | ----------------------------------------------------------------------------- |
| Cannot access on 3002       | See [QUICK_COMMANDS.md](QUICK_COMMANDS.md#-troubleshooting)                   |
| Backend not responding      | Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#-backend-api-not-responding)  |
| Database timeout            | Check [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md#-database-connection-timeout) |
| SSL certificate error       | See [QUICK_COMMANDS.md](QUICK_COMMANDS.md#ssl-certificate-issues)             |
| Secrets accidentally pushed | See [GIT_GUIDELINES.md](GIT_GUIDELINES.md#q-i-push-env-lên-rồi-sao-bây-giờ)   |

---

## 📞 Support & Resources

**For Developers**: Read [SETUP_GUIDE.md](SETUP_GUIDE.md)  
**For Admins**: Read [SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md)  
**For Quick Help**: Use [QUICK_COMMANDS.md](QUICK_COMMANDS.md)  
**For Security**: Review [GIT_GUIDELINES.md](GIT_GUIDELINES.md)  
**For Details**: Read [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)

---

## 📝 File Status

| Document             | Status              | Last Updated |
| -------------------- | ------------------- | ------------ |
| SETUP_GUIDE.md       | ✅ Active           | Current      |
| SERVER_DEPLOYMENT.md | ✅ Active           | Current      |
| DEPLOYMENT_GUIDE.md  | ✅ Active           | Current      |
| QUICK_COMMANDS.md    | ✅ Active           | Current      |
| GIT_GUIDELINES.md    | ✅ Active           | Current      |
| GITIGNORE_STATUS.md  | ✅ Active           | Current      |
| docker-compose.yml   | ✅ Updated for 3002 | Current      |

---

## 🎯 Next Steps

1. **Clone project**: `git clone <repo>`
2. **Run quick start**: Follow commands above
3. **Read relevant docs**: Choose from the path at top
4. **Test deployment**: Access https://localhost:3002
5. **Deploy to server**: Follow SERVER_DEPLOYMENT.md

---

**Ready to deploy? Start with the Quick Start section above! 🚀**

For detailed help, refer to the documentation files based on your role above. 📖
