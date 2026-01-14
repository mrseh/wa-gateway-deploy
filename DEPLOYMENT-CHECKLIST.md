# 📋 Deployment Checklist

Gunakan checklist ini untuk memastikan deployment yang sukses.

## Pre-Deployment (Persiapan)

### Server Requirements
- [ ] Ubuntu 20.04 LTS atau lebih tinggi
- [ ] Minimal 8 GB RAM (16 GB direkomendasikan)
- [ ] Minimal 4 CPU cores (8 cores direkomendasikan)
- [ ] Minimal 100 GB storage SSD
- [ ] 100 Mbps bandwidth unmetered
- [ ] Root atau sudo access

### Domain & DNS
- [ ] Domain sudah dibeli dan aktif
- [ ] DNS records sudah dikonfigurasi:
  - [ ] A record untuk `@` (root domain)
  - [ ] A record untuk `www`
  - [ ] A record untuk `api`
  - [ ] A record untuk `evolution`
- [ ] DNS propagasi selesai (test: `dig yourdomain.com`)

### External Services
- [ ] Akun Midtrans (payment gateway) siap
  - [ ] Server Key tersedia
  - [ ] Client Key tersedia
- [ ] Akun email SMTP siap (Gmail/SendGrid/dll)
  - [ ] SMTP host
  - [ ] SMTP username
  - [ ] SMTP password/app-specific password
- [ ] (Optional) Akun Xendit untuk payment alternatif
- [ ] (Optional) Sentry untuk error tracking

## Deployment Steps

### 1. Initial Server Setup
- [ ] Server OS terinstall (Ubuntu 20.04+)
- [ ] SSH access berfungsi
- [ ] Firewall dikonfigurasi (UFW)
  ```bash
  sudo ufw allow 22
  sudo ufw allow 80
  sudo ufw allow 443
  sudo ufw enable
  ```
- [ ] Server time zone sudah benar
  ```bash
  sudo timedatectl set-timezone Asia/Jakarta
  ```

### 2. Clone Repository
- [ ] Git terinstall
  ```bash
  sudo apt update
  sudo apt install -y git
  ```
- [ ] Repository di-clone
  ```bash
  git clone https://github.com/yourusername/wa-gateway-deploy.git
  cd wa-gateway-deploy
  ```

### 3. Environment Configuration
- [ ] File `.env` dibuat dari `.env.example`
  ```bash
  cp .env.example .env
  ```
- [ ] Password yang aman di-generate
  ```bash
  # Generate passwords
  openssl rand -base64 32  # Untuk POSTGRES_PASSWORD
  openssl rand -base64 32  # Untuk REDIS_PASSWORD
  openssl rand -base64 32  # Untuk JWT_SECRET
  openssl rand -base64 32  # Untuk REFRESH_TOKEN_SECRET
  ```
- [ ] Semua konfigurasi di `.env` sudah diisi:
  - [ ] `DOMAIN=yourdomain.com`
  - [ ] `EMAIL=admin@yourdomain.com`
  - [ ] Database passwords
  - [ ] JWT secrets
  - [ ] Evolution API key
  - [ ] Midtrans credentials
  - [ ] SMTP configuration
  - [ ] Grafana password

### 4. SSL Certificates
- [ ] Certbot installed (otomatis via deploy script)
- [ ] SSL certificates generated
  ```bash
  docker-compose run --rm certbot certonly --webroot \
    --webroot-path=/var/www/certbot \
    --email admin@yourdomain.com \
    --agree-tos --no-eff-email \
    -d yourdomain.com \
    -d www.yourdomain.com \
    -d api.yourdomain.com \
    -d evolution.yourdomain.com
  ```
- [ ] Nginx configuration updated dengan domain yang benar
  ```bash
  sed -i 's/yourdomain.com/your-actual-domain.com/g' nginx/nginx.conf
  ```

### 5. Docker Installation
- [ ] Docker terinstall dan running
  ```bash
  docker --version
  docker ps
  ```
- [ ] Docker Compose terinstall
  ```bash
  docker-compose --version
  ```
- [ ] Docker dapat dijalankan tanpa sudo (optional)
  ```bash
  sudo usermod -aG docker $USER
  ```

### 6. Build & Deploy
- [ ] Docker images di-pull
  ```bash
  docker-compose pull
  ```
- [ ] Custom images di-build
  ```bash
  docker-compose build
  ```
- [ ] Database containers distart terlebih dahulu
  ```bash
  docker-compose up -d postgres redis influxdb
  ```
- [ ] Wait for databases (30 detik)
- [ ] Database migrations dijalankan
  ```bash
  docker-compose exec api npx prisma migrate deploy
  ```
- [ ] Semua services distart
  ```bash
  docker-compose up -d
  ```

### 7. Verification
- [ ] Semua containers running
  ```bash
  docker-compose ps
  ```
- [ ] API health check OK
  ```bash
  curl https://api.yourdomain.com/api/v1/health
  ```
- [ ] Frontend accessible
  ```bash
  curl -I https://yourdomain.com
  ```
- [ ] SSL certificates valid
  ```bash
  curl -vI https://yourdomain.com 2>&1 | grep -i ssl
  ```
- [ ] No errors in logs
  ```bash
  docker-compose logs --tail=50
  ```

### 8. Initial Configuration
- [ ] Admin user created
  ```bash
  docker-compose exec api node scripts/create-admin.js
  ```
- [ ] Default packages created (Prisma seed)
- [ ] System settings configured
- [ ] Test login berfungsi

### 9. Monitoring Setup
- [ ] Prometheus accessible (internal only)
- [ ] Grafana accessible
  ```bash
  http://yourdomain.com:3001
  ```
- [ ] Default dashboards imported
- [ ] Alert rules configured
- [ ] Email notifications tested

### 10. Backup Configuration
- [ ] Backup directory created
  ```bash
  mkdir -p /backups
  ```
- [ ] Backup script tested
  ```bash
  ./scripts/backup-database.sh
  ```
- [ ] Cron job untuk daily backup setup
  ```bash
  sudo crontab -e
  # Add: 0 2 * * * /opt/wa-gateway/scripts/backup-database.sh
  ```
- [ ] Restore procedure tested
- [ ] Off-site backup configured (S3/etc)

## Post-Deployment

### Security Hardening
- [ ] Firewall rules verified
  ```bash
  sudo ufw status
  ```
- [ ] Fail2ban installed dan configured
  ```bash
  sudo apt install fail2ban
  ```
- [ ] SSH key-only authentication enabled
- [ ] Root login disabled
- [ ] Automatic security updates enabled
  ```bash
  sudo apt install unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```
- [ ] Rate limiting tested
- [ ] CORS configuration verified

### Performance Tuning
- [ ] Database indices created (dari Prisma schema)
- [ ] Redis memory limit configured
- [ ] Nginx worker processes optimized
- [ ] PostgreSQL tuning applied
- [ ] Monitoring baseline established

### Testing
- [ ] Registration flow tested
- [ ] Login/logout tested
- [ ] WhatsApp instance creation tested
- [ ] Message sending tested
- [ ] Payment flow tested (sandbox)
- [ ] OLT monitoring tested
- [ ] PON PORT monitoring tested
- [ ] Email notifications tested
- [ ] Webhook endpoints tested

### Documentation
- [ ] Admin credentials documented (securely!)
- [ ] API endpoints documented
- [ ] Common tasks documented
- [ ] Troubleshooting guide updated
- [ ] Team trained on system

### Go-Live Preparation
- [ ] Payment gateway switched to production
- [ ] Email sending verified
- [ ] Performance under load tested
- [ ] Backup/restore tested
- [ ] Incident response plan ready
- [ ] Support channel setup
- [ ] Monitoring alerts configured
- [ ] SSL auto-renewal verified

## Maintenance Checklist (Ongoing)

### Daily
- [ ] Check service health
  ```bash
  ./scripts/health-check.sh
  ```
- [ ] Monitor disk space
  ```bash
  df -h
  ```
- [ ] Review error logs
  ```bash
  docker-compose logs --tail=100 | grep -i error
  ```
- [ ] Verify backups completed

### Weekly
- [ ] Review Grafana dashboards
- [ ] Check for security updates
  ```bash
  sudo apt update && sudo apt list --upgradable
  ```
- [ ] Review user activity
- [ ] Clean old logs
  ```bash
  docker-compose logs --since 7d > /dev/null
  ```
- [ ] Database vacuum (automatic di PostgreSQL)

### Monthly
- [ ] Full system backup
- [ ] Security audit
- [ ] Performance review
- [ ] Capacity planning
- [ ] Update dependencies
- [ ] SSL certificate check
- [ ] Incident review

## Rollback Plan

Jika terjadi masalah setelah deployment:

1. **Stop new services**
   ```bash
   docker-compose down
   ```

2. **Restore from backup**
   ```bash
   ./scripts/restore-backup.sh /backups/latest.tar.gz
   ```

3. **Start previous version**
   ```bash
   git checkout previous-version
   docker-compose up -d
   ```

4. **Verify restoration**
   ```bash
   ./scripts/health-check.sh
   ```

5. **Notify users** (if applicable)

## Emergency Contacts

- [ ] On-call engineer: __________________
- [ ] Backup contact: __________________
- [ ] Hosting provider support: __________________
- [ ] Domain registrar support: __________________

## Sign-off

- [ ] **Technical Lead:** ______________ Date: ______
- [ ] **Project Manager:** ______________ Date: ______
- [ ] **Client/Stakeholder:** ______________ Date: ______

---

**Deployment Date:** __________  
**Deployed By:** __________  
**Version:** __________  
**Environment:** Production  

**Notes:**
_Add any additional notes or observations here_
