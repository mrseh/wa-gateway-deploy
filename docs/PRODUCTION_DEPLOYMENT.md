# 🚀 Production Deployment Guide

## Prerequisites

### Server Requirements
- **OS:** Ubuntu 22.04 LTS or higher
- **CPU:** Minimum 4 cores (8+ recommended)
- **RAM:** Minimum 16GB (32GB+ recommended)
- **Storage:** 
  - Minimum 100GB SSD for application
  - Additional storage for backups (500GB+ recommended)
- **Network:** 
  - Static IP address
  - Open ports: 80, 443, 22

### Software Requirements
- Docker 24.0+ 
- Docker Compose 2.20+
- Git
- OpenSSL
- Curl/Wget

---

## 🔧 Step-by-Step Deployment

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y git curl wget openssl

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installations
docker --version
docker-compose --version

# Log out and back in for group changes to take effect
```

### 2. Clone Repository

```bash
# Create deployment directory
sudo mkdir -p /opt/wa-gateway
sudo chown $USER:$USER /opt/wa-gateway
cd /opt/wa-gateway

# Clone repository (or upload files)
git clone https://github.com/your-org/wa-gateway.git .

# Or use rsync for direct upload:
# rsync -avz --progress /local/path/ user@server:/opt/wa-gateway/
```

### 3. Configure Environment

```bash
# Copy production environment template
cp .env.production.example .env

# Edit with your values
nano .env

# IMPORTANT: Change ALL "CHANGE_ME_*" values!
# Generate secure passwords:
openssl rand -hex 32  # For JWT_SECRET
openssl rand -base64 24  # For passwords
```

**Critical Environment Variables to Set:**
- `POSTGRES_PASSWORD`
- `REDIS_PASSWORD`
- `INFLUXDB_TOKEN`
- `JWT_SECRET`
- `EVOLUTION_API_KEY`
- `SMTP_USER` and `SMTP_PASS`
- `MIDTRANS_SERVER_KEY` and `MIDTRANS_CLIENT_KEY`
- `GRAFANA_PASSWORD`

### 4. Update Domain Configuration

```bash
# Update nginx configuration with your domain
sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/nginx.conf

# Update environment variables
sed -i 's/yourdomain.com/your-actual-domain.com/g' .env
```

### 5. DNS Configuration

**Add DNS Records:**
```
Type    Name        Value              TTL
A       @           YOUR_SERVER_IP     3600
A       www         YOUR_SERVER_IP     3600
A       api         YOUR_SERVER_IP     3600
A       evolution   YOUR_SERVER_IP     3600
```

**Verify DNS propagation:**
```bash
nslookup yourdomain.com
nslookup api.yourdomain.com
```

### 6. Setup SSL Certificates

```bash
# Make scripts executable
chmod +x scripts/*.sh

# Setup SSL with Let's Encrypt
sudo ./scripts/setup-ssl.sh yourdomain.com admin@yourdomain.com

# This will:
# - Stop nginx temporarily
# - Obtain SSL certificates
# - Update nginx config
# - Setup auto-renewal cron job
```

### 7. Initialize Database

```bash
# Start database services first
docker-compose -f docker-compose.production.yml up -d postgres redis influxdb

# Wait for databases to be ready
sleep 30

# Run migrations
docker-compose -f docker-compose.production.yml run --rm api npm run migrate

# Verify migrations
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U wagateway -d wagateway -c "\dt"
```

### 8. Deploy All Services

```bash
# Deploy using the deployment script
sudo ./scripts/deploy.sh

# Or manually:
docker-compose -f docker-compose.production.yml up -d --build

# Monitor deployment
docker-compose -f docker-compose.production.yml logs -f
```

### 9. Verify Deployment

```bash
# Check all services are running
docker-compose -f docker-compose.production.yml ps

# Test health endpoints
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/health/detailed

# Check Evolution API
curl http://localhost:8080/instance/fetchInstances

# Access frontend
curl https://yourdomain.com
```

### 10. Setup Automated Backups

```bash
# Test backup script
sudo ./scripts/backup.sh

# Setup daily backup cron job
sudo crontab -e

# Add line:
0 3 * * * /opt/wa-gateway/scripts/backup.sh >> /var/log/wa-gateway-backup.log 2>&1

# Verify cron job
sudo crontab -l
```

---

## 📊 Post-Deployment Configuration

### Access Monitoring

1. **Grafana Dashboard:**
   - URL: http://your-server-ip:3001
   - Username: admin
   - Password: (from .env GRAFANA_PASSWORD)

2. **Prometheus:**
   - URL: http://your-server-ip:9090

3. **MinIO Console:**
   - URL: http://your-server-ip:9001
   - Username: minio
   - Password: (from .env MINIO_ROOT_PASSWORD)

### Create First Admin User

```bash
# Via API
curl -X POST https://api.yourdomain.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@yourdomain.com",
    "password": "SecurePassword123!",
    "company_name": "Your Company"
  }'

# Or via frontend:
# Navigate to https://yourdomain.com/register
```

### Setup Payment Gateway

1. **Midtrans Configuration:**
   - Login to Midtrans Dashboard
   - Get Server Key and Client Key
   - Configure webhook: `https://api.yourdomain.com/api/v1/payments/midtrans/webhook`
   - Test payment flow

2. **Create Packages:**
```sql
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U wagateway -d wagateway

INSERT INTO packages (id, name, price, max_instances, max_messages_per_day, features) 
VALUES 
  ('pkg-starter', 'Starter', 25000, 2, 1000, '{"bulk_messages": true}'::jsonb),
  ('pkg-pro', 'Professional', 75000, 5, 5000, '{"bulk_messages": true, "olt_monitoring": true}'::jsonb);
```

---

## 🔒 Security Hardening

### 1. Firewall Configuration

```bash
# Install UFW
sudo apt install ufw

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# Enable firewall
sudo ufw enable
sudo ufw status
```

### 2. SSH Hardening

```bash
# Edit SSH config
sudo nano /etc/ssh/sshd_config

# Recommended settings:
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
X11Forwarding no

# Restart SSH
sudo systemctl restart sshd
```

### 3. Install Fail2Ban

```bash
# Install
sudo apt install fail2ban -y

# Configure
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local

# Add nginx protection
sudo nano /etc/fail2ban/filter.d/nginx-limit-req.conf

# Start service
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 4. Enable Automatic Updates

```bash
# Install unattended-upgrades
sudo apt install unattended-upgrades -y

# Configure
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## 📈 Performance Optimization

### 1. Database Tuning

```bash
# Edit PostgreSQL configuration
docker-compose -f docker-compose.production.yml exec postgres \
  nano /var/lib/postgresql/data/postgresql.conf

# Recommended settings:
shared_buffers = 4GB
effective_cache_size = 12GB
maintenance_work_mem = 1GB
work_mem = 64MB
max_connections = 200
```

### 2. Redis Optimization

```bash
# Monitor Redis
docker-compose -f docker-compose.production.yml exec redis redis-cli info

# Set maxmemory policy
docker-compose -f docker-compose.production.yml exec redis \
  redis-cli CONFIG SET maxmemory 2gb
docker-compose -f docker-compose.production.yml exec redis \
  redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 3. Nginx Caching

Already configured in nginx.conf with:
- Static file caching (365 days)
- Gzip compression
- HTTP/2 enabled
- Connection pooling

---

## 🔄 Maintenance Tasks

### Daily Tasks
- Monitor service logs
- Check disk space
- Verify backups completed
- Review error logs

### Weekly Tasks
- Review analytics
- Check system updates
- Monitor performance metrics
- Test restore procedure

### Monthly Tasks
- Security audit
- Update dependencies
- Rotate secrets
- Capacity planning
- Full backup test

---

## 🆘 Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.production.yml logs [service-name]

# Check resource usage
docker stats

# Check disk space
df -h

# Restart specific service
docker-compose -f docker-compose.production.yml restart [service-name]
```

### Database Connection Issues

```bash
# Test connection
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U wagateway -d wagateway -c "SELECT 1;"

# Check connections
docker-compose -f docker-compose.production.yml exec postgres \
  psql -U wagateway -d wagateway -c \
  "SELECT count(*) FROM pg_stat_activity;"
```

### SSL Certificate Issues

```bash
# Test certificate
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Force renewal
docker-compose -f docker-compose.production.yml run --rm certbot renew --force-renewal

# Check certificate expiry
echo | openssl s_client -servername yourdomain.com -connect yourdomain.com:443 2>/dev/null | openssl x509 -noout -dates
```

### High Memory Usage

```bash
# Check container memory
docker stats --no-stream

# Restart heavy service
docker-compose -f docker-compose.production.yml restart api

# Clear Redis cache
docker-compose -f docker-compose.production.yml exec redis redis-cli FLUSHDB
```

---

## 📞 Support

For support:
- Documentation: https://docs.yourdomain.com
- Email: support@yourdomain.com
- Community: https://community.yourdomain.com

---

## ✅ Production Checklist

Before going live, ensure:

### Infrastructure
- [ ] Server meets minimum requirements
- [ ] DNS records configured
- [ ] SSL certificates installed
- [ ] Firewall configured
- [ ] Fail2Ban installed

### Application
- [ ] All environment variables set
- [ ] Database migrations run
- [ ] Services all running
- [ ] Health checks passing
- [ ] Monitoring active

### Security
- [ ] Strong passwords set
- [ ] SSH keys configured
- [ ] Root login disabled
- [ ] Automatic updates enabled
- [ ] Backups configured

### Testing
- [ ] User registration works
- [ ] Login/logout works
- [ ] Message sending works
- [ ] Payment flow works
- [ ] Webhooks receiving
- [ ] Email notifications sending

### Monitoring
- [ ] Grafana accessible
- [ ] Prometheus collecting metrics
- [ ] Alerts configured
- [ ] Logs being collected
- [ ] Backup alerts working

---

**Deployment Date:** _____________
**Deployed By:** _____________
**Version:** 1.0.0

