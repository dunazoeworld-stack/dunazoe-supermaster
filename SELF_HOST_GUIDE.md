# SELF_HOST_GUIDE.md
# DUNAZOE — Self-Host Complete Guide

**Version:** v1.0.0-rc1  
**Generated:** 2026-06-29

---

## Minimum Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| RAM | 4 GB | 8 GB |
| CPU | 2 cores | 4 cores |
| Disk | 20 GB | 50 GB |
| OS | Ubuntu 22.04 | Ubuntu 22.04 LTS |
| Docker | 24+ | 24+ |
| Node.js | 20 LTS | 20 LTS |

---

## Full Self-Host Steps

### 1. Server Setup (Contabo VPS ~$12/mo)

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose git curl nginx certbot python3-certbot-nginx
systemctl enable docker && systemctl start docker
```

### 2. Clone & Configure

```bash
git clone https://github.com/dunazoeworld-stack/dunazoe-supermaster
cd dunazoe-supermaster/apps/core
cp .env.example .env.docker
nano .env.docker
# Fill every variable — especially JWT_SECRET (64 chars random)
```

### 3. Start Platform

```bash
# Full 33-service stack
docker-compose -f docker-compose.yml up --build -d

# Or lightweight (8 services, lower RAM)
docker-compose -f docker-compose.beta.yml up --build -d

# Verify
docker-compose ps          # All should show 'Up'
curl localhost:3000/health # {"status":"ok"}
```

### 4. DNS Setup (Namecheap)

1. Log into Namecheap → Domain List → dunazoe.com → Manage
2. Advanced DNS → Add Record:
   - Type: A, Host: @, Value: YOUR_SERVER_IP
   - Type: A, Host: www, Value: YOUR_SERVER_IP
   - Type: A, Host: api, Value: YOUR_SERVER_IP

### 5. SSL (HTTPS)

```bash
certbot --nginx -d dunazoe.com -d www.dunazoe.com -d api.dunazoe.com
# Follow prompts — auto-renews via cron
```

### 6. Verify Live

```bash
curl https://dunazoe.com/health
# Open https://dunazoe.com/deploy on phone
```

---

## Monitoring

```bash
# Service status
docker-compose ps

# Logs
docker logs dunazoe-gateway --tail 50
docker logs dunazoe-deployment-ai --tail 50

# Admin UI
https://dunazoe.com/deploy/monitor
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| JWT_SECRET error | Set in .env.docker (≥32 chars) |
| DB connection failed | Check DATABASE_URL format |
| Service keeps restarting | `docker logs dunazoe-{service} --tail 100` |
| Port 3000 not accessible | Check firewall: `ufw allow 3000` |
| SSL fails | Ensure DNS A records pointing to server IP |

---

## Self-Management Panel

Access at: `/deploy/self`

Actions available:
- 💾 Backup State
- 📤 Export Config
- 🏥 Health Check
- 🔄 Restart Service
- ♻️ Restore

---
*DUNAZOE Deployment AI Control Plane*
