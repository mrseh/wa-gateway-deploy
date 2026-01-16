# WhatsApp Gateway SaaS Platform

Production-ready WhatsApp Gateway platform with Evolution API and PON PORT monitoring.

## 🎯 Features

- ✅ **Multi-tenant WhatsApp Gateway** - Multiple users, multiple instances
- ✅ **Evolution API Integration** - Stable WhatsApp Web API
- ✅ **OLT & PON PORT Monitoring** - Real-time fiber network monitoring
- ✅ **Mikrotik Integration** - Network events and alerts
- ✅ **Zabbix Integration** - Infrastructure monitoring
- ✅ **Bulk Messaging** - Campaign management with CSV import
- ✅ **Analytics & Reporting** - Comprehensive dashboard and insights
- ✅ **Payment Integration** - Midtrans payment gateway
- ✅ **Real-time Monitoring** - WebSocket updates and metrics

## 📋 Tech Stack

- **Backend:** Node.js 18 + Express
- **Frontend:** Next.js 14 + TypeScript + Tailwind CSS
- **Database:** PostgreSQL 15 + TimescaleDB
- **Cache:** Redis 7
- **Time-series:** InfluxDB 2
- **WhatsApp Engine:** Evolution API v2.1
- **Container:** Docker + Docker Compose
- **Monitoring:** Prometheus + Grafana

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for local development)
- Git

### 1. Clone Repository

```bash
git clone https://github.com/your-org/whatsapp-gateway.git
cd whatsapp-gateway
```

### 2. Setup Environment

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your configuration
nano .env

cd ..
```

### 3. Start Services

```bash
# Start all services with Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Check services status
docker-compose -f docker-compose.dev.yml ps

# View logs
docker-compose -f docker-compose.dev.yml logs -f
```

### 4. Run Migrations

```bash
# Enter backend container
docker-compose -f docker-compose.dev.yml exec backend sh

# Run migrations
npm run migrate

# Exit container
exit
```

### 5. Access Services

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:8000
- **Evolution API:** http://localhost:8080
- **Grafana:** http://localhost:3001 (admin/admin)
- **MinIO Console:** http://localhost:9001 (minioadmin/minioadmin)
- **InfluxDB:** http://localhost:8086

## 📦 Project Structure

```
whatsapp-gateway/
├── backend/                 # Backend API (Node.js)
│   ├── src/
│   │   ├── config/         # Configuration files
│   │   ├── migrations/     # Database migrations
│   │   ├── models/         # Database models
│   │   ├── controllers/    # Route controllers
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Express middleware
│   │   ├── routes/         # API routes
│   │   ├── utils/          # Utility functions
│   │   └── index.js        # App entry point
│   ├── tests/              # Test files
│   ├── Dockerfile
│   ├── package.json
│   └── .env.example
│
├── frontend/               # Frontend UI (Next.js)
│   ├── app/               # Next.js app directory
│   ├── components/        # React components
│   ├── lib/               # Utilities and helpers
│   ├── public/            # Static assets
│   ├── package.json
│   └── .env.example
│
├── monitoring/             # Monitoring configuration
│   ├── prometheus/        # Prometheus config
│   └── grafana/          # Grafana dashboards
│
├── docker-compose.dev.yml # Development compose
├── docker-compose.yml     # Production compose
└── README.md
```

## 🔧 Development

### Backend Development

```bash
cd backend

# Install dependencies
npm install

# Run in development mode (with hot reload)
npm run dev

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

### Database Migrations

```bash
# Run all pending migrations
npm run migrate

# Check migration status
npm run migrate:status

# Rollback last migration
npm run migrate:rollback
```

### Frontend Development

```bash
cd frontend

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## 🔐 Environment Variables

### Backend (.env)

```bash
# Application
NODE_ENV=development
PORT=8000
APP_URL=http://localhost:3000
API_URL=http://localhost:8000

# Database
DATABASE_URL=postgresql://wagateway:password@localhost:5432/wagateway
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=wagateway
POSTGRES_PASSWORD=wagateway_password
POSTGRES_DB=wagateway

# Redis
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-characters-long
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=your-super-secret-refresh-token-key-min-32-characters
JWT_REFRESH_EXPIRES_IN=7d

# SMTP Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM_EMAIL=noreply@yourdomain.com

# Evolution API
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin

# InfluxDB
INFLUXDB_URL=http://localhost:8086
INFLUXDB_TOKEN=your-influxdb-token
INFLUXDB_ORG=wagateway
INFLUXDB_BUCKET=pon_monitoring

# Payment (Midtrans)
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=false
```

## 📚 API Documentation

### Authentication

```bash
# Register
POST /api/v1/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "company_name": "Acme Corp"
}

# Login
POST /api/v1/auth/login
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}

# Verify Email
POST /api/v1/auth/verify-email
{
  "token": "verification-token"
}
```

### Instances

```bash
# Create Instance
POST /api/v1/instances
Authorization: Bearer {token}
{
  "name": "My WhatsApp"
}

# Get Instances
GET /api/v1/instances
Authorization: Bearer {token}

# Get QR Code
GET /api/v1/instances/:id/qr
Authorization: Bearer {token}

# Send Message
POST /api/v1/messages/send
Authorization: Bearer {token}
{
  "instance_id": "uuid",
  "to": "6282216328142",
  "message": "Hello from WhatsApp Gateway!"
}
```

### OLT Monitoring

```bash
# Add OLT
POST /api/v1/olts
Authorization: Bearer {token}
{
  "name": "OLT-01",
  "vendor": "ZTE",
  "ip_address": "192.168.1.1",
  "snmp_community": "public"
}

# Get OLT Details
GET /api/v1/olts/:id
Authorization: Bearer {token}

# Get PON Port Metrics
GET /api/v1/pon-ports/:id/metrics?period=24h
Authorization: Bearer {token}
```

## 🧪 Testing

### Run Tests

```bash
# Backend tests
cd backend
npm test                 # All tests
npm run test:unit       # Unit tests
npm run test:integration # Integration tests
npm run test:coverage   # Coverage report

# Frontend tests
cd frontend
npm test
```

### Load Testing

```bash
# Install k6
brew install k6  # macOS
# or
sudo apt install k6  # Ubuntu

# Run load test
k6 run tests/load/k6-load-test.js
```

## 📊 Monitoring

### Prometheus Metrics

Access Prometheus at http://localhost:9090

Available metrics:
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request duration
- `messages_sent_total` - Total messages sent
- `instances_connected` - Connected WhatsApp instances
- `pon_port_utilization` - PON port utilization

### Grafana Dashboards

Access Grafana at http://localhost:3001 (admin/admin)

Pre-configured dashboards:
- System Overview
- Message Analytics
- PON Monitoring
- Instance Status

## 🔒 Security

- ✅ HTTPS enforced (production)
- ✅ JWT authentication with refresh tokens
- ✅ Password hashing (bcrypt, cost 12)
- ✅ Rate limiting
- ✅ Input validation & sanitization
- ✅ SQL injection prevention
- ✅ XSS protection
- ✅ CSRF protection
- ✅ Secure headers
- ✅ Webhook signature verification

## 🚢 Deployment

### Production Deployment

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Run migrations
docker-compose exec backend npm run migrate

# Check logs
docker-compose logs -f
```

### SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx configuration with SSL paths
```

## 📝 License

Proprietary - All rights reserved

## 👥 Support

- **Email:** support@yourdomain.com
- **Documentation:** https://docs.yourdomain.com
- **Issues:** https://github.com/your-org/whatsapp-gateway/issues

## 🙏 Acknowledgments

- Evolution API - WhatsApp Web API
- TimescaleDB - Time-series database
- Midtrans - Payment gateway

---

Made with ❤️ by Your Company
