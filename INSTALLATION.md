# WhatsApp Gateway SaaS Platform - INSTALLATION

## 📦 PACKAGE CONTENTS

This archive contains COMPLETE source code:
- ✅ Backend API (Node.js + Express) - 75 files
- ✅ Frontend Dashboard (Next.js 14) - 48 files  
- ✅ PON Monitoring Service (Python) - 10 files
- ✅ Docker Configuration
- ✅ Database Migrations (13 files)
- ✅ All Controllers, Models, Services
- ✅ Complete Frontend UI

**Total: 177 files, ~24,000 lines of code**

---

## 🚀 QUICK INSTALLATION (3 Steps)

### Step 1: Extract Archive
```bash
tar -xzf whatsapp-gateway-FULL-SOURCE-CODE.tar.gz
cd whatsapp-gateway
```

### Step 2: Deploy Everything
```bash
chmod +x DEPLOY_NOW.sh
sudo bash DEPLOY_NOW.sh
```

### Step 3: Access Application
```
Frontend: http://localhost:3000
API: http://localhost:8000
```

**That's it! Application is RUNNING!**

---

## 📋 SYSTEM REQUIREMENTS

- **OS:** Ubuntu 20.04+ / Debian 11+
- **RAM:** 8GB minimum (16GB recommended)
- **Disk:** 50GB minimum
- **Docker:** 20.10+
- **Docker Compose:** 2.0+

---

## 🔧 MANUAL INSTALLATION

If DEPLOY_NOW.sh doesn't work, follow these steps:

### 1. Install Docker
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

### 2. Configure Environment
```bash
# Backend environment
cp backend/.env.example backend/.env
nano backend/.env
# Edit: POSTGRES_PASSWORD, REDIS_PASSWORD, JWT_SECRET

# Frontend environment  
echo "NEXT_PUBLIC_API_URL=http://localhost:8000" > frontend/.env.local
```

### 3. Start Services
```bash
docker-compose up -d
```

### 4. Wait & Migrate
```bash
sleep 60
docker-compose exec api npm run migrate
```

### 5. Verify
```bash
docker-compose ps
curl http://localhost:8000/health
```

---

## 🗂️ PROJECT STRUCTURE

```
whatsapp-gateway/
├── backend/                # Node.js API
│   ├── src/
│   │   ├── config/        # Database, Redis config
│   │   ├── controllers/   # 13 controllers
│   │   ├── models/        # 13 models
│   │   ├── services/      # 11 services
│   │   ├── routes/        # API routes
│   │   ├── middleware/    # Auth, validation
│   │   ├── migrations/    # 13 DB migrations
│   │   ├── jobs/          # Background jobs
│   │   └── utils/         # Helpers
│   ├── package.json
│   └── Dockerfile
├── frontend/              # Next.js Dashboard
│   ├── app/              # 17 pages
│   ├── components/       # 21+ components
│   ├── services/         # API clients
│   ├── package.json
│   └── Dockerfile
├── pon-monitoring/        # Python SNMP Poller
│   ├── poller.py         # Main poller (600+ lines)
│   ├── vendors/          # 4 vendor implementations
│   ├── requirements.txt
│   └── Dockerfile
├── docker-compose.yml     # Main compose file
├── nginx/                 # Nginx config
├── monitoring/            # Prometheus + Grafana
├── scripts/              # Deployment scripts
├── DEPLOY_NOW.sh         # One-command deploy
└── README.md             # This file
```

---

## 🎯 FEATURES INCLUDED

### Core Features
- ✅ Multi-tenant user system
- ✅ WhatsApp instance management
- ✅ Message sending (text, media, bulk)
- ✅ Webhook receiver
- ✅ Payment integration (Midtrans)
- ✅ Subscription management

### Monitoring
- ✅ OLT & PON PORT monitoring (SNMP)
- ✅ Multi-vendor support (ZTE, Huawei, FiberHome, VSOL)
- ✅ Real-time metrics (InfluxDB)
- ✅ Alert system

### Integrations
- ✅ Mikrotik router events
- ✅ Zabbix monitoring
- ✅ Email notifications

### Analytics
- ✅ Message statistics
- ✅ Dashboard charts
- ✅ Usage tracking
- ✅ Report generation

---

## 🔐 DEFAULT CREDENTIALS

After first deployment, you need to:
1. Register via UI: http://localhost:3000
2. Create your admin account
3. Set up your first instance

**No default admin account** - You create your own!

---

## 📊 SERVICES

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Next.js Dashboard |
| API | 8000 | Node.js Backend |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |
| Evolution API | 8080 | WhatsApp Engine |
| InfluxDB | 8086 | Time-series DB |
| MinIO | 9000/9001 | File Storage |

---

## 🐛 TROUBLESHOOTING

### Services not starting?
```bash
docker-compose logs -f
docker-compose restart [service]
```

### Database errors?
```bash
docker-compose restart postgres
docker-compose exec api npm run migrate
```

### Port conflicts?
```bash
# Check what's using the port
lsof -i :3000
lsof -i :8000

# Kill the process
kill -9 [PID]
```

### Reset everything?
```bash
docker-compose down -v
sudo bash DEPLOY_NOW.sh
```

---

## 📝 CONFIGURATION

### Backend (.env)
```bash
# Required - Change these!
POSTGRES_PASSWORD=your-strong-password
REDIS_PASSWORD=your-redis-password
JWT_SECRET=your-jwt-secret-min-32-chars

# Optional
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
MIDTRANS_SERVER_KEY=your-server-key
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

## 🧪 TESTING

Run automated tests:
```bash
chmod +x test-deployment.sh
./test-deployment.sh
```

---

## 📚 API DOCUMENTATION

Once deployed, access Swagger docs:
```
http://localhost:8000/api-docs
```

---

## 🆘 SUPPORT

### Common Commands
```bash
# View logs
docker-compose logs -f [service]

# Restart service
docker-compose restart [service]

# Stop all
docker-compose down

# Start fresh
docker-compose down -v
docker-compose up -d
```

### Issues?
1. Check logs: `docker-compose logs -f`
2. Run test: `./test-deployment.sh`
3. Check status: `docker-compose ps`

---

## ⚡ PRODUCTION DEPLOYMENT

For production with SSL:
```bash
# 1. Edit domain
nano scripts/setup-ssl.sh
# Change: DOMAIN="yourdomain.com"

# 2. Run SSL setup
sudo bash scripts/setup-ssl.sh

# 3. Deploy production
docker-compose -f docker-compose.production.yml up -d
```

See `docs/PRODUCTION_DEPLOYMENT.md` for full guide.

---

## 📈 MONITORING

Access monitoring dashboards:
- Grafana: http://localhost:3001
- Prometheus: http://localhost:9090

Default login:
- User: admin
- Pass: admin (change on first login)

---

## ✅ SUCCESS CHECKLIST

After deployment, verify:
- [ ] All services running (8+ containers)
- [ ] API health check OK
- [ ] Frontend accessible
- [ ] Can register user
- [ ] Can login
- [ ] Can create WhatsApp instance
- [ ] QR code displays

If all checked → **YOU'RE READY! 🎉**

---

## 📄 LICENSE

Proprietary - All rights reserved

---

## 🎉 ENJOY!

Your WhatsApp Gateway is now running!

Start by:
1. Register account at http://localhost:3000
2. Create WhatsApp instance  
3. Scan QR code with WhatsApp
4. Start sending messages!
