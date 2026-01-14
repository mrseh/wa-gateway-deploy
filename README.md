# WhatsApp Gateway SaaS - Production Deployment Guide

## 📋 Table of Contents
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Manual Deployment](#manual-deployment)
- [Configuration](#configuration)
- [SSL Setup](#ssl-setup)
- [Database Migration](#database-migration)
- [Monitoring](#monitoring)
- [Backup & Recovery](#backup--recovery)
- [Troubleshooting](#troubleshooting)
- [Maintenance](#maintenance)

## 🔧 Prerequisites

### Minimum Server Requirements
- **OS:** Ubuntu 20.04 LTS or higher
- **CPU:** 4 cores (8 cores recommended)
- **RAM:** 8 GB (16 GB recommended)
- **Storage:** 100 GB SSD (250 GB recommended)
- **Bandwidth:** 100 Mbps unmetered

### Software Requirements
- Docker 20.10+
- Docker Compose 2.0+
- Git
- curl

### Domain Requirements
You need a domain with the following subdomains:
- `yourdomain.com` - Main frontend
- `api.yourdomain.com` - Backend API
- `evolution.yourdomain.com` - Evolution API

### Payment Gateway
- Midtrans account (https://midtrans.com)
- Xendit account (optional) (https://xendit.com)

### Email (SMTP)
- Gmail, SendGrid, or any SMTP service

## 🚀 Quick Start (Automated Deployment)

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/wa-gateway-deploy.git
cd wa-gateway-deploy
```

### 2. Run Deployment Script
```bash
sudo chmod +x deploy.sh
sudo ./deploy.sh
```

The script will:
- ✅ Install Docker & Docker Compose
- ✅ Setup environment variables
- ✅ Generate SSL certificates
- ✅ Initialize database
- ✅ Start all services
- ✅ Create admin user
- ✅ Setup monitoring

### 3. Post-Deployment
After deployment completes:
1. Visit `https://yourdomain.com`
2. Login with admin credentials
3. Configure payment gateway
4. Test all functionalities

## 📖 Manual Deployment

### Step 1: Prepare Server

#### Update System
```bash
sudo apt update && sudo apt upgrade -y
```

#### Install Docker
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
sudo systemctl enable docker
sudo systemctl start docker
```

#### Install Docker Compose
```bash
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
docker-compose --version
```

### Step 2: Clone and Configure

#### Clone Repository
```bash
git clone https://github.com/yourusername/wa-gateway-deploy.git
cd wa-gateway-deploy
```

#### Setup Environment
```bash
cp .env.example .env
nano .env
```

**Required Changes in .env:**
```env
# Update these values:
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
DOMAIN=yourdomain.com
EMAIL=admin@yourdomain.com

# Generate strong passwords:
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
JWT_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)

# Payment Gateway
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-app-specific-password
```

### Step 3: DNS Configuration

Point your domains to server IP:
```
A     @                    -> YOUR_SERVER_IP
A     www                  -> YOUR_SERVER_IP
A     api                  -> YOUR_SERVER_IP
A     evolution            -> YOUR_SERVER_IP
```

Wait for DNS propagation (can take up to 24 hours, but usually 5-10 minutes)

Verify:
```bash
dig yourdomain.com
dig api.yourdomain.com
```

### Step 4: SSL Certificates

#### Option 1: Let's Encrypt (Recommended)
```bash
# Create required directories
mkdir -p certbot/conf certbot/www

# Generate certificates
docker-compose run --rm certbot certonly --webroot \
  --webroot-path=/var/www/certbot \
  --email admin@yourdomain.com \
  --agree-tos \
  --no-eff-email \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d api.yourdomain.com \
  -d evolution.yourdomain.com
```

#### Option 2: Self-Signed (Testing Only)
```bash
mkdir -p nginx/ssl

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/C=ID/ST=Jakarta/L=Jakarta/O=WA Gateway/CN=yourdomain.com"
```

### Step 5: Update Nginx Configuration

Edit `nginx/nginx.conf`:
```bash
# Replace all instances of "yourdomain.com" with your actual domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/nginx.conf
```

### Step 6: Build and Start Services

#### Pull Images
```bash
docker-compose pull
```

#### Build Custom Images
```bash
docker-compose build
```

#### Start Database First
```bash
docker-compose up -d postgres redis influxdb
```

Wait for databases to be ready (30 seconds):
```bash
sleep 30
```

#### Run Database Migrations
```bash
docker-compose up -d api
sleep 10
docker-compose exec api npx prisma migrate deploy
```

#### Start All Services
```bash
docker-compose up -d
```

### Step 7: Verify Deployment

Check all containers are running:
```bash
docker-compose ps
```

Expected output:
```
NAME                    STATUS
wa_gateway_nginx        Up
wa_gateway_frontend     Up (healthy)
wa_gateway_api          Up (healthy)
wa_gateway_evolution    Up
wa_gateway_poller       Up
wa_gateway_postgres     Up (healthy)
wa_gateway_redis        Up (healthy)
wa_gateway_influxdb     Up
wa_gateway_minio        Up
wa_gateway_prometheus   Up
wa_gateway_grafana      Up
```

Check logs for errors:
```bash
# All services
docker-compose logs --tail=50

# Specific service
docker-compose logs -f api
docker-compose logs -f frontend
docker-compose logs -f evolution-api
```

### Step 8: Create Admin User

```bash
docker-compose exec api node << 'EOF'
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createAdmin() {
  const passwordHash = await bcrypt.hash('admin123', 10);
  
  const admin = await prisma.user.create({
    data: {
      email: 'admin@yourdomain.com',
      passwordHash,
      name: 'Admin',
      isVerified: true,
      isActive: true
    }
  });
  
  console.log('Admin user created:', admin.email);
  console.log('Password: admin123');
  console.log('Please change this password immediately!');
}

createAdmin().then(() => process.exit(0));
EOF
```

### Step 9: Test the Application

#### Frontend
```bash
curl -I https://yourdomain.com
```

Should return `200 OK`

#### API Health Check
```bash
curl https://api.yourdomain.com/api/v1/health
```

Should return:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2026-01-13T..."
  }
}
```

#### Login Test
```bash
curl -X POST https://api.yourdomain.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@yourdomain.com",
    "password": "admin123"
  }'
```

Should return access token and refresh token.

## ⚙️ Configuration

### Environment Variables

All configuration is in `.env` file. Key variables:

#### Application
```env
NODE_ENV=production
APP_URL=https://yourdomain.com
API_URL=https://api.yourdomain.com
```

#### Database
```env
POSTGRES_USER=wagateway
POSTGRES_PASSWORD=your-strong-password
POSTGRES_DB=wagateway
DATABASE_URL=postgresql://...
```

#### Security
```env
JWT_SECRET=your-jwt-secret-min-32-chars
REFRESH_TOKEN_SECRET=your-refresh-secret-min-32-chars
```

#### Payment
```env
MIDTRANS_SERVER_KEY=your-midtrans-server-key
MIDTRANS_CLIENT_KEY=your-midtrans-client-key
MIDTRANS_IS_PRODUCTION=true
```

#### Features
```env
ENABLE_REGISTRATION=true
ENABLE_EMAIL_VERIFICATION=true
TRIAL_PERIOD_DAYS=7
```

### Nginx Tuning

For high traffic, edit `nginx/nginx.conf`:

```nginx
# Worker processes
worker_processes auto;

# Worker connections
events {
    worker_connections 4096;
}

# Rate limits
limit_req_zone $binary_remote_addr zone=api_limit:20m rate=20r/s;
```

### PostgreSQL Tuning

For better performance:

```bash
# Edit docker-compose.yml
services:
  postgres:
    command:
      - postgres
      - -c
      - max_connections=200
      - -c
      - shared_buffers=2GB
      - -c
      - effective_cache_size=6GB
      - -c
      - maintenance_work_mem=512MB
      - -c
      - checkpoint_completion_target=0.9
      - -c
      - wal_buffers=16MB
      - -c
      - default_statistics_target=100
      - -c
      - random_page_cost=1.1
      - -c
      - effective_io_concurrency=200
      - -c
      - work_mem=10MB
      - -c
      - min_wal_size=1GB
      - -c
      - max_wal_size=4GB
```

### Redis Tuning

```bash
# Edit docker-compose.yml
services:
  redis:
    command: >
      redis-server
      --maxmemory 4gb
      --maxmemory-policy allkeys-lru
      --save 900 1
      --save 300 10
      --save 60 10000
```

## 📊 Monitoring

### Access Monitoring Dashboards

#### Grafana
- URL: `http://yourdomain.com:3001`
- Username: `admin` (from GRAFANA_USER)
- Password: From GRAFANA_PASSWORD in .env

#### Prometheus
- URL: `http://yourdomain.com:9090`
- Metrics: `http://api.yourdomain.com/metrics`

### Key Metrics to Monitor

1. **API Performance**
   - Request duration (p95, p99)
   - Request rate
   - Error rate

2. **Database**
   - Connection pool usage
   - Query duration
   - Cache hit rate

3. **System Resources**
   - CPU usage
   - Memory usage
   - Disk space
   - Network bandwidth

4. **Business Metrics**
   - Active instances
   - Messages sent/received
   - User signups
   - Subscription renewals

### Alerts Configuration

Edit `prometheus/prometheus.yml` for alerts:

```yaml
rule_files:
  - 'alerts.yml'

# alerts.yml
groups:
  - name: api_alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        annotations:
          summary: "High error rate detected"
```

## 💾 Backup & Recovery

### Automated Backups

Setup cron job for daily backups:

```bash
# Edit crontab
crontab -e

# Add this line for daily backup at 2 AM
0 2 * * * /opt/wa-gateway/scripts/backup-database.sh >> /var/log/wa-gateway-backup.log 2>&1
```

### Manual Backup

```bash
./scripts/backup-database.sh
```

Backups are stored in `/backups/` directory.

### Restore from Backup

```bash
# Extract backup
cd /backups
tar xzf wa_gateway_backup_YYYYMMDD_HHMMSS.tar.gz
cd wa_gateway_backup_YYYYMMDD_HHMMSS

# Restore PostgreSQL
gunzip postgres.sql.gz
cat postgres.sql | docker-compose exec -T postgres psql -U wagateway wagateway

# Restore Evolution API data
docker-compose exec -T evolution-api tar xzf - -C / < evolution.tar.gz

# Restart services
docker-compose restart
```

### Disaster Recovery

1. **Complete Server Failure**
   ```bash
   # On new server
   git clone your-repo
   cd wa-gateway-deploy
   
   # Restore .env
   scp old-server:/opt/wa-gateway/.env .
   
   # Deploy
   sudo ./deploy.sh
   
   # Restore backup
   scp old-server:/backups/latest.tar.gz /backups/
   ./scripts/restore-backup.sh /backups/latest.tar.gz
   ```

2. **Database Corruption**
   ```bash
   # Stop services
   docker-compose stop api evolution-api poller
   
   # Restore from backup
   ./scripts/restore-backup.sh /backups/latest.tar.gz
   
   # Verify data integrity
   docker-compose exec postgres psql -U wagateway -c "SELECT COUNT(*) FROM users;"
   
   # Restart services
   docker-compose start api evolution-api poller
   ```

## 🔧 Troubleshooting

### Common Issues

#### 1. Services Not Starting

**Check logs:**
```bash
docker-compose logs service-name
```

**Common causes:**
- Port already in use: `sudo lsof -i :port`
- Insufficient memory: `free -h`
- Disk space full: `df -h`

**Solutions:**
```bash
# Kill process using port
sudo kill -9 $(sudo lsof -t -i:8000)

# Increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Clean up disk space
docker system prune -a
```

#### 2. Database Connection Failed

**Check PostgreSQL:**
```bash
docker-compose exec postgres psql -U wagateway -c "SELECT 1;"
```

**Check logs:**
```bash
docker-compose logs postgres
```

**Solutions:**
```bash
# Restart PostgreSQL
docker-compose restart postgres

# Verify environment variables
docker-compose exec api env | grep DATABASE_URL

# Test connection
docker-compose exec api node -e "
  const { PrismaClient } = require('@prisma/client');
  new PrismaClient().\$connect()
    .then(() => console.log('✓ Connected'))
    .catch(e => console.error('✗ Error:', e.message));
"
```

#### 3. Evolution API Not Connecting

**Check Evolution API:**
```bash
docker-compose logs evolution-api
curl http://localhost:8080/health
```

**Solutions:**
```bash
# Restart Evolution API
docker-compose restart evolution-api

# Clear Evolution data
docker-compose down
docker volume rm wa-gateway-deploy_evolution_instances
docker volume rm wa-gateway-deploy_evolution_store
docker-compose up -d
```

#### 4. SSL Certificate Issues

**Check certificates:**
```bash
ls -la certbot/conf/live/yourdomain.com/
```

**Renew certificates:**
```bash
docker-compose run --rm certbot renew
docker-compose restart nginx
```

**Test SSL:**
```bash
curl -vI https://yourdomain.com
openssl s_client -connect yourdomain.com:443
```

#### 5. High Memory Usage

**Check memory:**
```bash
docker stats
free -h
```

**Solutions:**
```bash
# Limit container memory
# Edit docker-compose.yml
services:
  api:
    mem_limit: 2g
    mem_reservation: 1g

# Clear cache
docker-compose exec redis redis-cli FLUSHALL

# Restart services
docker-compose restart
```

### Performance Issues

#### Slow API Response

1. **Check database queries:**
   ```sql
   -- Enable slow query log
   ALTER SYSTEM SET log_min_duration_statement = 1000;
   SELECT pg_reload_conf();
   
   -- View slow queries
   docker-compose exec postgres tail -f /var/lib/postgresql/data/log/postgresql-*.log
   ```

2. **Check cache hit rate:**
   ```bash
   docker-compose exec redis redis-cli INFO stats
   ```

3. **Optimize database:**
   ```bash
   docker-compose exec postgres psql -U wagateway -c "
     VACUUM ANALYZE;
     REINDEX DATABASE wagateway;
   "
   ```

#### High CPU Usage

```bash
# Identify process
docker stats

# Check slow queries
docker-compose exec postgres psql -U wagateway -c "
  SELECT pid, query_start, state, query
  FROM pg_stat_activity
  WHERE state = 'active'
  ORDER BY query_start;
"

# Kill long-running queries
docker-compose exec postgres psql -U wagateway -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE state = 'active'
  AND query_start < NOW() - INTERVAL '5 minutes';
"
```

## 🔄 Maintenance

### Regular Tasks

#### Daily
- ✅ Check service health
- ✅ Monitor disk space
- ✅ Review error logs
- ✅ Verify backups

```bash
# Daily health check script
./scripts/health-check.sh
```

#### Weekly
- ✅ Update dependencies
- ✅ Review security alerts
- ✅ Test restore process
- ✅ Clean old logs

```bash
# Weekly maintenance
docker-compose exec postgres psql -U wagateway -c "VACUUM ANALYZE;"
docker system prune -f
./scripts/test-backup-restore.sh
```

#### Monthly
- ✅ Security audit
- ✅ Performance review
- ✅ Capacity planning
- ✅ Update documentation

### Updates

#### Application Updates

```bash
# Backup first
./scripts/backup-database.sh

# Pull latest code
git pull origin main

# Rebuild images
docker-compose build

# Run migrations
docker-compose exec api npx prisma migrate deploy

# Restart services
docker-compose up -d

# Verify health
./scripts/health-check.sh
```

#### Security Updates

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Update Docker images
docker-compose pull

# Restart services
docker-compose up -d
```

### Scaling

#### Horizontal Scaling (Multiple Servers)

1. **Setup Load Balancer**
   - Use AWS ELB, Google Cloud Load Balancer, or HAProxy
   - Configure health checks
   - Enable sticky sessions

2. **Shared Database**
   - Use managed PostgreSQL (AWS RDS, Google Cloud SQL)
   - Configure connection pooling
   - Enable replication

3. **Shared Redis**
   - Use managed Redis (AWS ElastiCache, Google Cloud Memorystore)
   - Configure Redis Cluster
   - Enable persistence

#### Vertical Scaling (Same Server)

```bash
# Increase resources in docker-compose.yml
services:
  api:
    cpus: '4'
    mem_limit: 8g
  
  postgres:
    cpus: '4'
    mem_limit: 8g
```

## 📞 Support

### Getting Help

1. **Documentation:** Check this README first
2. **Logs:** Always include relevant logs
3. **Community:** Discord/Slack channel
4. **Email:** support@yourdomain.com

### Reporting Issues

Include:
- Server specs
- Docker version
- Error logs
- Steps to reproduce
- Expected vs actual behavior

## 📝 License

MIT License - see LICENSE file

---

**🎉 Deployment Complete!**

Your WhatsApp Gateway SaaS is now running at:
- Frontend: https://yourdomain.com
- API: https://api.yourdomain.com
- Grafana: http://yourdomain.com:3001

**Next Steps:**
1. Change admin password
2. Configure payment gateway
3. Test all features
4. Setup monitoring alerts
5. Create user documentation

**Important Security Notes:**
- ⚠️ Change all default passwords immediately
- ⚠️ Enable firewall (UFW)
- ⚠️ Setup fail2ban
- ⚠️ Regular security audits
- ⚠️ Keep everything updated

Good luck! 🚀
