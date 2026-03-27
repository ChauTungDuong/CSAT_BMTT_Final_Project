# 🚫 Git Guidelines - Files NOT to Push to GitHub

## Tổng Quan

Tài liệu này liệt kê các file/folder **KHÔNG** nên push lên GitHub vì lý do bảo mật, kích thước, hoặc tính chất private.

---

## 1. Files & Folders Cấm (Đã có trong .gitignore)

### 🔐 Secrets & Credentials

| Đường dẫn                 | Lý do                                             | Thay thế                       |
| ------------------------- | ------------------------------------------------- | ------------------------------ |
| `backend/.env`            | Chứa database password, JWT keys, encryption keys | `backend/.env.example`         |
| `backend/.env.local`      | Environment local                                 | `backend/.env.example`         |
| `backend/.env.production` | Production secrets                                | `backend/.env.example`         |
| `backend/ssl/`            | SSL certificates & private keys                   | Generate tại server deployment |
| `monitor/.env`            | Monitor environment                               | `monitor/.env.example`         |

**Action:**

```bash
# ✅ LÀM
git add backend/.env.example   # Template
git add monitor/.env.example

# ❌ KHÔNG LÀM
git add backend/.env           # Never!
git add backend/ssl/key.pem    # Never!
```

---

### 📦 Node Dependencies

| Đường dẫn                   | Kích thước | Lý do                                                | Lệnh rebuild  |
| --------------------------- | ---------- | ---------------------------------------------------- | ------------- |
| `node_modules/`             | ~1GB       | Được install từ package.json                         | `npm install` |
| `backend/node_modules/`     | ~500MB     | Được install từ package.json                         | `npm install` |
| `frontend/node_modules/`    | ~300MB     | Được install từ package.json                         | `npm install` |
| `monitor/node_modules/`     | ~300MB     | Được install từ package.json                         | `npm install` |
| `backend/package-lock.json` | Optional   | Package lock - nên push nếu muốn consistent versions | -             |

**Action:**

```bash
# ✅ LÀM
git add package.json           # Luôn push!
git add package-lock.json      # Optional nhưng recommended

# ❌ KHÔNG LÀM
git add node_modules/          # Never!
# Đã có rule: node_modules/ trong .gitignore
```

---

### 📁 Build & Compile Output

| Đường dẫn        | Kích thước | Lý do                            |
| ---------------- | ---------- | -------------------------------- |
| `backend/dist/`  | ~50MB      | Được generate từ `npm run build` |
| `frontend/dist/` | ~5MB       | Được generate từ `npm run build` |
| `monitor/dist/`  | ~2MB       | Được generate từ `npm run build` |

**Action:**

```bash
# ✅ LÀM
git add src/           # Source code
git add tsconfig.json  # Config

# ❌ KHÔNG LÀM
git add dist/          # Never! Generate tại deployment
git add *.js (compiled files)
```

---

### 📊 Database & Logs

| Đường dẫn              | Lý do                                 | Người cần?                |
| ---------------------- | ------------------------------------- | ------------------------- |
| Logs mọi loại          | Logs dùng local debug, dung lượng lớn | Local dev only            |
| `*.log`                | Docker/Application logs               | Local dev only            |
| `backend/test_log.txt` | Test logs                             | Local dev only            |
| Database backups       | Dữ liệu nhạy cảm                      | Backup server, không repo |
| `./backups/`           | Database exports                      | Backup server, không repo |

**Rule:**

```bash
# ✅ .gitignore rule (đã có)
*.log
logs/

# Nếu logs folder lớn:
echo "logs/" >> .gitignore
```

---

### 🐳 Docker Artifacts

| File                        | Kích thước | Lý do            | Rebuild?                       |
| --------------------------- | ---------- | ---------------- | ------------------------------ |
| Docker volume `oracle_data` | ~10GB      | Dữ liệu database | `docker compose up -d` tạo lại |
| `.dockerignore`             | -          | ✅ Được push     | -                              |
| `Dockerfile`                | -          | ✅ Được push     | -                              |
| `docker-compose.yml`        | -          | ✅ Được push     | -                              |
| `nginx.conf`                | -          | ✅ Được push     | -                              |

---

## 2. Files & Folders Nên Push

### ✅ Bắt Buộc Push

```
# Config & Build
✅ package.json          # Dependencies
✅ package-lock.json     # Optional nhưng recommend
✅ tsconfig.json         # TypeScript config
✅ vite.config.ts        # Vite config
✅ tailwind.config.js    # Tailwind config
✅ jest.config.js        # Test config
✅ .eslintrc.json        # Linter config
✅ .prettierrc            # Code formatter config

# Source Code
✅ src/**/*.ts           # Backend source
✅ src/**/*.tsx          # Frontend source
✅ src/**/*.css          # Styles

# SQL & Migrations
✅ backend/sql/          # Schema & migrations
✅ backend/scripts/      # Setup scripts
✅ migration.sql         # Migration files

# Docker
✅ Dockerfile            # Image definition
✅ docker-compose.yml    # Service orchestration
✅ nginx.conf            # Nginx server config

# Documentation
✅ README.md             # Project overview
✅ SETUP_GUIDE.md        # Dev setup
✅ DEPLOYMENT_GUIDE.md   # Server deployment (TÁI LIỆU NÀY)
✅ INSTRUCTIONS.md       # Project instructions
✅ aes-gcm-documentation.md  # Crypto docs

# GitHub Config
✅ .gitignore            # Git ignore rules
✅ .gitattributes        # Git attributes
✅ .github/workflows/    # CI/CD workflows (nếu có)
```

### ✅ Templates & Guides

```
✅ backend/.env.example       # Template (dùng để hướng dẫn triển khai)
✅ monitor/.env.example       # Template
✅ GIT_GUIDELINES.md          # Tài liệu này
```

### ✨ Optional (Nice to have)

```
✨ AGENT_BUILD_GUIDE.md      # Hướng dẫn AI/agent build
✨ CONTRIBUTING.md            # Hướng dẫn contribute (nếu open source)
✨ LICENSE                    # License file
```

---

## 3. Quy Tắc Commit

### Trước khi Push

```bash
# 1. Kiểm tra file sắp commit
git status

# 2. Xem diff trước push
git diff --stat
git diff               # Xem chi tiết

# 3. Kiểm tra không vô tình thêm .env hoặc secrets
git diff --cached backend/.env    # Không được xuất hiện

# 4. Nếu vô tình add .env, remove ngay:
git rm --cached backend/.env
echo "backend/.env" >> .gitignore
git add .gitignore
```

### Kiểm tra .gitignore

```bash
# Xem file bị ignore hiện tại
git check-ignore -v backend/.env
git check-ignore -v node_modules/*

# Kiểm tra tất cả
git status --porcelain | grep ^!!

# ✅ Kết quả mong muốn:
# !! backend/.env
# !! node_modules/
# !! backend/ssl/
```

---

## 4. Khôi phục sau Sự Cố

### Vô tình Push Secrets

```bash
# ❌ NGUY HIỂM: Secret đã ở trên GitHub!
# Cần:
# 1. Rotate tất cả secrets (passwords, keys)
# 2. Dùng BFG Repo-Cleaner hoặc git-filter-branch để xóa history
# 3. Python re-deploy

# Tạm thời disables branch
git push --force origin HEAD --no-verify

# Hoặc yêu cầu admin xóa repo (nếu public)
```

### Missed trong .gitignore

```bash
# 1. Thêm rule mới
echo "*.pid" >> .gitignore

# 2. Remove từ tracking
git rm --cached "*.pid"

# 3. Commit
git commit -m "chore: update gitignore"
git push
```

---

## 5. Checklist Pre-Push

Chạy trước mỗi lần `git push`:

```bash
#!/bin/bash
# save as: pre-push-check.sh

echo "🔍 Pre-push Security Check..."

# 1. .env files
if git diff --cached --name-only | grep -E "\.env($|\.)" > /dev/null; then
    echo "❌ ERROR: .env file detected in commit!"
    exit 1
fi

# 2. SSL keys
if git diff --cached --name-only | grep "\.pem$" > /dev/null; then
    echo "❌ ERROR: Private key (.pem) detected in commit!"
    exit 1
fi

# 3. node_modules
if git diff --cached --name-only | grep "node_modules" > /dev/null; then
    echo "❌ ERROR: node_modules detected in commit!"
    exit 1
fi

# 4. Database files
if git diff --cached --name-only | grep -E "\.(dmp|bak|sql\.orig)$" > /dev/null; then
    echo "❌ WARNING: Database backup file detected!"
    read -p "Continue? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

echo "✅ Pre-push checks passed!"
exit 0
```

**Dùng:**

```bash
chmod +x pre-push-check.sh
./pre-push-check.sh
# If OK
git push
```

---

## 6. Useful Commands

### Xem file scope

```bash
# Xem file bị ignore
git ls-files --others --ignored --exclude-standard

# Xem file tracked
git ls-files

# Xem untracked
git ls-files --others --exclude-standard
```

### Dọn dẹp local

```bash
# Remove untracked files (DRY RUN)
git clean -fd -n

# Remove thực tế
git clean -fd

# Remove bao gồm ignored files
git clean -fdx
```

### Show commits

```bash
# History commits
git log --oneline -10

# Show file changes per commit
git log --name-only -5

# Show who changed what
git blame src/main.ts | head -10
```

---

## 7. Quy Tắc Dự Án Cấu Thể

### Branching

```
main (stable)
  ↓
develop (integration)
  ↓
feature/[name]     # Tính năng mới
hotfix/[name]      # Bug fix critical
release/[version]  # Release candidate
```

### Commit Messages

```bash
# ✅ Tốt
git commit -m "feat: add masking for DOB field"
git commit -m "fix: database connection timeout"
git commit -m "docs: update deployment guide"

# ❌ Tránh
git commit -m "fix"
git commit -m "changes"
git commit -m "asdf"
```

### PR/Merge Request Checklist

- [ ] Branch từ develop (hoặc main)
- [ ] Commit messages rõ ràng
- [ ] Không chứa .env, logs, build artifacts
- [ ] `npm run build` thành công
- [ ] Tests pass (nếu có)
- [ ] Code review passed
- [ ] Merge squash nếu nhiều commits nhỏ

---

## 8. Troubleshooting

### Q: Tôi push .env lên rồi, sao bây giờ?

A:

```bash
1. Rotate tất cả secrets ngay lập tức
   - Database password
   - JWT_SECRET
   - AES_MASTER_KEY
   - Cập nhật database users

2. Remove từ git history (nếu private repo):
   git filter-branch --tree-filter 'rm -f backend/.env' HEAD

3. Force push (⚠️ cảnh báo team)
   git push --force origin main

4. Nếu public repo:
   - Yêu cầu admin xóa & recreate repo
   - Regenerate tất cả secrets
```

### Q: Sai .gitignore, file lớn đã push?

A:

```bash
1. Add .gitignore rule
   echo "*.log" >> .gitignore

2. Remove từ tracking
   git rm --cached *.log

3. Commit
   git commit -m "chore: cleanup large log files"
   git push
```

### Q: Vô tình commit compiled files?

A:

```bash
1. Add rule
   echo "dist/" >> .gitignore

2. Remove
   git rm --cached -r dist/

3. Commit
   git commit -m "chore: remove dist from repo"
   git push
```

---

**🤝 Summary:**

- **Never push**: `.env`, `ssl/`, `node_modules/`, `dist/`, `*.log`
- **Always push**: `src/`, `*.json` (package), `Dockerfile`, SQL migrations, docs
- **Before push**: Run `git status` and `git diff` to verify

Hỏi thêm? Liên hệ team lead! 🚀
