# 🚀 QUICK START - Development Setup

## Prerequisites

- Docker & Docker Compose installed
- Git
- 8GB RAM minimum
- 20GB disk space

---

## 📦 Step 1: Clone & Setup

```bash
# Clone repository
git clone <your-repo-url>
cd whatsapp-gateway

# Give execute permissions to scripts
chmod +x scripts/*.sh
```

---

## 🔧 Step 2: Environment Configuration

### Backend Environment

```bash
cd backend
cat > .env << 'EOF'
# Application
NODE_ENV=development
PORT=8000
APP_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://wagateway:wagateway123@postgres:5432/wagateway
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=wagateway
POSTGRES_PASSWORD=wagateway123
POSTGRES_DB=wagateway

# Redis
REDIS_URL=redis://redis:6379

# InfluxDB
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=dev-token-12345678901234567890123456789012
INFLUXDB_ORG=wagateway
INFLUXDB_BUCKET=pon_monitoring

# Evolution API
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976

# JWT
JWT_SECRET=dev-jwt-secret-key-minimum-32-characters-long-for-security
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Email (Optional for dev)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@localhost

# Payment (Optional for dev)
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_CLIENT_KEY=your-client-key
MIDTRANS_IS_PRODUCTION=false
EOF

cd ..
```

### Frontend Environment

```bash
cd frontend
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF

cd ..
```

---

## 🐳 Step 3: Start Services

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Wait for services to be ready (30-60 seconds)
echo "Waiting for services to start..."
sleep 60

# Check service status
docker-compose -f docker-compose.dev.yml ps
```

Expected output:
```
NAME                          STATUS    PORTS
wa-gateway-api-dev           Up        0.0.0.0:8000->8000/tcp
wa-gateway-evolution-dev     Up        0.0.0.0:8080->8080/tcp
wa-gateway-frontend-dev      Up        0.0.0.0:3000->3000/tcp
wa-gateway-influxdb-dev      Up        0.0.0.0:8086->8086/tcp
wa-gateway-minio-dev         Up        0.0.0.0:9000-9001->9000-9001/tcp
wa-gateway-pon-poller-dev    Up
wa-gateway-postgres-dev      Up        0.0.0.0:5432->5432/tcp
wa-gateway-redis-dev         Up        0.0.0.0:6379->6379/tcp
```

---

## 🗄️ Step 4: Initialize Database

```bash
# Run migrations
docker-compose -f docker-compose.dev.yml exec api npm run migrate

# Verify tables were created
docker-compose -f docker-compose.dev.yml exec postgres psql -U wagateway -d wagateway -c "\dt"
```

Expected output should show 15 tables:
- users
- packages
- subscriptions
- transactions
- instances
- message_logs
- webhook_logs
- alert_templates
- olts
- pon_ports
- onus
- mikrotik_events
- zabbix_events
- bulk_messages
- usage_stats

---

## ✅ Step 5: Verify Everything Works

### Test Backend API

```bash
# Health check
curl http://localhost:8000/health

# Expected: {"status":"ok","timestamp":"...","uptime":...}
```

### Test Evolution API

```bash
curl http://localhost:8080/instance/fetchInstances

# Expected: Success response or empty array
```

### Test Frontend

```bash
# Open browser
open http://localhost:3000

# Or using curl
curl -I http://localhost:3000

# Expected: HTTP/1.1 200 OK
```

### Test Database Connection

```bash
docker-compose -f docker-compose.dev.yml exec postgres psql -U wagateway -d wagateway -c "SELECT 1;"

# Expected:
#  ?column? 
# ----------
#         1
```

---

## 📝 Step 6: Create Test User

```bash
# Register first user
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@test.com",
    "password": "Admin123!",
    "company_name": "Test Company"
  }'

# Expected: Success response with user data
```

### Login and Get Token

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin123!"
  }'

# Copy the access_token from response
```

### Create WhatsApp Instance

```bash
# Replace YOUR_TOKEN with the access_token from login
curl -X POST http://localhost:8000/api/v1/instances \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "My WhatsApp"
  }'

# Expected: Response with QR code
```

---

## 🌐 Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| **Frontend** | http://localhost:3000 | Register via UI |
| **Backend API** | http://localhost:8000 | - |
| **Evolution API** | http://localhost:8080 | API Key: B6D711FCDE4D4FD5936544120E713976 |
| **MinIO Console** | http://localhost:9001 | minioadmin / minioadmin123 |
| **InfluxDB** | http://localhost:8086 | admin / adminpassword |

---

## 📊 View Logs

```bash
# All services
docker-compose -f docker-compose.dev.yml logs -f

# Specific service
docker-compose -f docker-compose.dev.yml logs -f api
docker-compose -f docker-compose.dev.yml logs -f frontend
docker-compose -f docker-compose.dev.yml logs -f evolution-api
```

---

## 🛠️ Common Commands

### Restart Service

```bash
docker-compose -f docker-compose.dev.yml restart api
```

### Rebuild Service

```bash
docker-compose -f docker-compose.dev.yml up -d --build api
```

### Stop All Services

```bash
docker-compose -f docker-compose.dev.yml down
```

### Stop and Remove All Data

```bash
docker-compose -f docker-compose.dev.yml down -v
```

### Access Container Shell

```bash
# Backend
docker-compose -f docker-compose.dev.yml exec api sh

# Database
docker-compose -f docker-compose.dev.yml exec postgres bash
```

---

## 🐛 Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose -f docker-compose.dev.yml logs [service-name]

# Check container status
docker-compose -f docker-compose.dev.yml ps

# Restart problematic service
docker-compose -f docker-compose.dev.yml restart [service-name]
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000
lsof -i :8000
lsof -i :8080

# Kill process
kill -9 [PID]
```

### Database Connection Error

```bash
# Check PostgreSQL is running
docker-compose -f docker-compose.dev.yml ps postgres

# Test connection
docker-compose -f docker-compose.dev.yml exec postgres pg_isready -U wagateway

# Restart PostgreSQL
docker-compose -f docker-compose.dev.yml restart postgres
```

### Migration Errors

```bash
# Check migration status
docker-compose -f docker-compose.dev.yml exec api npm run migrate:status

# Reset database (CAUTION: Deletes all data)
docker-compose -f docker-compose.dev.yml down -v
docker-compose -f docker-compose.dev.yml up -d postgres redis
sleep 10
docker-compose -f docker-compose.dev.yml exec api npm run migrate
```

### Evolution API Not Working

```bash
# Check Evolution logs
docker-compose -f docker-compose.dev.yml logs evolution-api

# Restart Evolution
docker-compose -f docker-compose.dev.yml restart evolution-api

# Test Evolution API
curl http://localhost:8080/instance/fetchInstances
```

---

## 🎯 What to Do Next

1. **Access Frontend**: http://localhost:3000
2. **Register Account**: Click "Register" and create account
3. **Create Instance**: Go to "Instances" → "Add Instance"
4. **Scan QR Code**: Use WhatsApp on your phone
5. **Send Message**: Try sending a test message

---

## 📚 Additional Resources

- **Full Documentation**: See `docs/` folder
- **API Documentation**: http://localhost:8000/api-docs (if enabled)
- **Production Deployment**: See `docs/PRODUCTION_DEPLOYMENT.md`

---

## ✅ Success Checklist

- [ ] All services running (8 containers)
- [ ] Database migrations completed
- [ ] Health check returns OK
- [ ] Frontend accessible
- [ ] Can register user
- [ ] Can login
- [ ] Can create instance
- [ ] QR code displayed

---

**If all steps above work, YOU'RE READY TO DEVELOP! 🎉**

Need help? Check logs with:
```bash
docker-compose -f docker-compose.dev.yml logs -f
```
