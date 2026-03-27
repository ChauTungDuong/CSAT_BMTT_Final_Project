# ⚡ Quick Commands Reference Card

**Save this file for quick access to common commands during deployment and maintenance**

---

## 🚀 Initial Setup (First Time)

```bash
# Clone project
git clone <REPO_URL> CSAT_Final_Project
cd CSAT_Final_Project

# Create environment file
cp backend/.env.example backend/.env

# Generate secrets (run 3 times for 3 different values)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate SSL certificates
mkdir -p backend/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Bank/CN=localhost"

# Start services
docker compose up -d --build

# Wait for database (~120s)
sleep 120

# Access at https://localhost:3002 or https://your-server:3002
```

---

## 🐳 Docker Commands

### Check Status

```bash
docker compose ps                      # All containers status
docker compose ps backend              # Specific service
docker compose logs -f                 # All logs (follow)
docker compose logs -f backend         # Specific service logs
docker compose logs backend | grep -i error

# One-liner health check
docker compose ps && echo "✅ All services running"
```

### Start/Stop

```bash
docker compose up -d                   # Start all (no rebuild)
docker compose up -d --build           # Start all (with rebuild)
docker compose up -d --build backend   # Rebuild specific service
docker compose stop                    # Stop all
docker compose restart                 # Restart all
docker compose restart backend         # Restart specific service
docker compose down                    # Stop & remove containers (keep data)
docker compose down -v                 # ⚠️ Remove everything including data
```

---

## 💾 Database Commands

### Connect to Database

```bash
# SQL CLI
docker exec -it oracle-xe sqlplus smask_user/App123456!@XEPDB1

# Run SQL file
docker exec -i oracle-xe sqlplus smask_user/App123456!@XEPDB1 < backend/sql/02_seed.sql

# Query without interactive
docker exec -i oracle-xe sqlplus -s smask_user/App123456!@XEPDB1 <<< "SELECT COUNT(*) FROM users; EXIT;"
```

### Check Database Health

```bash
docker compose logs oracle | grep "Completed"  # Should see: "Completed: ALTER DATABASE OPEN"
docker compose exec -T oracle healthcheck.sh   # Run health check script
```

---

## 🔧 Troubleshooting

### Application Not Accessible

```bash
# Check port 3002 is open
netstat -tulpn | grep 3002              # Linux/Mac
netstat -ano | findstr :3002            # Windows

# Check frontend container
docker compose ps frontend              # Should be "Up"
docker compose logs frontend            # Check logs

# Test HTTPS
curl -k https://localhost:3002          # -k ignores self-signed cert
```

### Backend API Error

```bash
# Check backend
docker compose ps backend               # Should be "Up"
docker compose logs backend | tail -50  # Last 50 lines

# Test API
docker compose exec bank-frontend curl http://bank-backend:3000/health

# Restart if needed
docker compose restart backend
```

### Database Not Ready

```bash
# Wait for startup
docker compose logs oracle | grep "Completed"

# If stuck, restart
docker compose restart oracle
sleep 120                               # Wait 2 minutes
docker compose up -d backend frontend   # Start dependent services
```

### SSL Certificate Issues

```bash
# Check cert exists
ls -la backend/ssl/

# Regenerate
rm -f backend/ssl/{cert.pem,key.pem}
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout backend/ssl/key.pem -out backend/ssl/cert.pem \
  -subj "/C=VN/ST=HCM/L=HoChiMinh/O=Bank/CN=localhost"

docker compose restart frontend
```

### Resource Issues (Out of Memory/Disk)

```bash
# Check disk space
df -h

# Check Docker resources
docker system df

# Clean up unused images/containers
docker system prune -a --volumes       # ⚠️ Warning: removes unused data
```

---

## 📊 Monitoring & Logs

### Real-time Monitoring

```bash
# Watch container stats
docker stats

# Follow logs (press Ctrl+C to exit)
docker compose logs -f --tail=50

# Watch specific service
watch -n 1 'docker compose ps'
```

### Export Logs

```bash
# Save logs to file
docker compose logs > logs-$(date +%Y%m%d-%H%M%S).txt

# Export and compress
docker compose logs | gzip > logs-backup.tar.gz
```

### Filter Logs

```bash
# Errors only
docker compose logs | grep -i error

# Specific time range (recent)
docker compose logs --since 10m backend

# Last 100 lines
docker compose logs backend | tail -100
```

---

## 🔄 CI/CD & Build Operations

### Backend Build

```bash
# Build NestJS
docker exec bank-backend npm run build

# Run tests
docker exec bank-backend npm test

# Run migrations (if available)
docker exec bank-backend npm run migration:run
```

### Frontend Build

```bash
# Build React project
docker exec bank-frontend npm run build

# Rebuild frontend container
docker compose up -d --build frontend
```

### Full Rebuild

```bash
# Rebuild everything from scratch
docker compose down -v                 # Remove old data
docker compose up -d --build           # Rebuild all services
```

---

## 🔐 Security & Backup

### Environment File

```bash
# Create from template
cp backend/.env.example backend/.env

# Change passwords (minimum 12 characters)
# Edit: DB_PASSWORD, DB_ROOT_PASSWORD, JWT_SECRET, AES_MASTER_KEY, HMAC_SECRET

# Verify not committed
git check-ignore -v backend/.env
# Should show: backend/.env
```

### SSL Certificate

```bash
# View certificate info
openssl x509 -in backend/ssl/cert.pem -text -noout

# Check expiration
openssl x509 -in backend/ssl/cert.pem -noout -dates
```

### Backup Database

```bash
# Export database
docker exec oracle-xe expdp smask_user/App123456!@XEPDB1 \
  DIRECTORY=DATA_PUMP_DIR DUMPFILE=backup-$(date +%Y%m%d).dmp

# Backup volumes
docker run --rm -v csat_final_project_oracle_data:/data \
  -v $(pwd):/backup alpine tar czf /backup/db-backup-$(date +%Y%m%d).tar.gz /data
```

---

## 📝 Git Operations

### Before Committing

```bash
# Check status
git status

# Show what will be committed
git diff --cached

# Verify no secrets
git diff --cached --name-only | grep -E "\.env|\.pem|node_modules"
# Should return: NOTHING

# If you accidentally added secrets
git rm --cached backend/.env
echo "backend/.env" >> .gitignore
git add .gitignore
```

### Commit & Push

```bash
# Add source code only (following .gitignore)
git add src/ backend/sql/ package*.json docker-compose.yml Dockerfile

# Commit
git commit -m "feat: add feature description"

# Push to repository
git push origin main
```

### Common Patterns

```bash
# Add only modified tracked files
git add -u

# See what would be added
git add -n src/ package.json

# Verify safe to push
git diff --name-only | head -20
```

---

## 📊 Performance Tweaks (Optional)

### Docker Resource Limits

Edit `docker-compose.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: "2" # Max 2 CPU cores
        memory: 2G # Max 2GB RAM
      reservations:
        cpus: "1"
        memory: 1G
```

### Database Connection Pool

Edit `backend/.env`:

```
DB_POOL_MIN=5
DB_POOL_MAX=20
```

---

## 🔍 Port Reference

| Port | Service  | Purpose                         | Required    |
| ---- | -------- | ------------------------------- | ----------- |
| 3002 | Frontend | Main application HTTPS          | ✅ Yes      |
| 3000 | Backend  | API server (Docker internal)    | ✅ Yes      |
| 3003 | Monitor  | Debug tool                      | ❌ Optional |
| 1521 | Database | Oracle listener (internal only) | ✅ Yes      |
| 5500 | Database | Oracle EM (internal only)       | ⚠️ Optional |

---

## 🆘 Emergency Commands

### If Everything Breaks

```bash
# Stop everything
docker compose stop

# Remove old containers (keep data)
docker compose down

# Clean rebuild from scratch
docker compose up -d --build

# If still broken, check disk space
df -h
docker system df

# Last resort: Remove all and start fresh
docker compose down -v      # ⚠️ WILL DELETE DATA
rm -f backend/.env backend/ssl/*.pem
# Start from initial setup section above
```

### Kill Stuck Processes

```bash
# Stop specific container
docker compose stop backend

# Kill all containers
docker compose kill

# Remove all (without data loss)
docker compose rm -f
```

---

## 📞 Quick Help

**Error Messages to Search For**:

- `"port already in use"` → Use different port in docker-compose.yml
- `"connection refused"` → Service not running or wrong port
- `"healthcheck failed"` → Database taking too long to start
- `"SSL certificate problem"` → Regenerate cert or use HTTP
- `"file not found"` → Check .env file exists with correct passwords

**Documentation to Read**:

- 📖 [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full deployment guide
- 📖 [GIT_GUIDELINES.md](GIT_GUIDELINES.md) - What to push to GitHub
- 📖 [SERVER_DEPLOYMENT.md](SERVER_DEPLOYMENT.md) - Server deployment checklist

**Common Issues**:

1. **Forgot .env password**: Edit backend/.env with new password, `docker compose restart backend`
2. **Lost SSL cert**: Regenerate using openssl command above, `docker compose restart frontend`
3. **Database won't start**: Wait 2+ minutes, check `docker compose logs oracle`
4. **Port conflict**: Use different port in docker-compose.yml, restart services

---

**Pro Tips:**

- Always read logs first: `docker compose logs`
- Use `docker compose ps` to verify all services are running
- Test with `curl -k https://localhost:3002` to verify HTTPS works
- Keep backups of database before major changes
- Document any custom configurations you make

**Last Updated**: March 2026  
**Project**: CSAT Banking System  
**Status**: ✅ Production Ready
