# 🚀 Quick Start Guide

Deploy WhatsApp Gateway SaaS in **5 minutes**!

## Prerequisites

- Ubuntu 20.04+ server
- Domain name with DNS configured
- Root access

## 1. Clone Repository

```bash
git clone https://github.com/yourusername/wa-gateway-deploy.git
cd wa-gateway-deploy
```

## 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

**Update these REQUIRED variables:**

```env
# Domain
DOMAIN=yourdomain.com
EMAIL=admin@yourdomain.com

# Database
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)

# JWT
JWT_SECRET=$(openssl rand -base64 32)
REFRESH_TOKEN_SECRET=$(openssl rand -base64 32)

# Evolution API
EVOLUTION_GLOBAL_API_KEY=$(openssl rand -base64 32)

# Email
SMTP_HOST=smtp.gmail.com
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-app-password

# Payment (get from dashboard)
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_CLIENT_KEY=your-client-key
```

## 3. Deploy

```bash
sudo chmod +x deploy.sh
sudo ./deploy.sh
```

**OR use Make:**

```bash
make deploy
```

The script will:
- ✅ Install Docker & Docker Compose
- ✅ Setup environment
- ✅ Generate SSL certificates
- ✅ Start all services
- ✅ Run database migrations
- ✅ Create admin user

## 4. Access Application

**Frontend:** https://yourdomain.com  
**API:** https://api.yourdomain.com  
**Evolution:** https://evolution.yourdomain.com  
**Grafana:** http://yourdomain.com:3001

**Default Admin:**
- Email: admin@yourdomain.com
- Password: admin123
- ⚠️ **Change immediately!**

## 5. Verify Installation

```bash
make health
```

Expected output:
```
✓ API - Healthy
✓ Frontend - Healthy
✓ Evolution API - Healthy
✓ PostgreSQL - Healthy
✓ Redis - Healthy
✓ InfluxDB - Healthy
```

## 6. Next Steps

1. **Change admin password**
   - Login to dashboard
   - Go to Settings → Change Password

2. **Configure payment gateway**
   - Midtrans: https://dashboard.midtrans.com
   - Update `.env` with real keys
   - Restart: `make restart`

3. **Setup email**
   - Use Gmail App Password or SMTP service
   - Test: Send verification email

4. **Create packages**
   - Go to Admin → Packages
   - Create pricing tiers

5. **Setup monitoring**
   - Open Grafana: http://yourdomain.com:3001
   - Import dashboards from `/grafana/dashboards/`

6. **Setup backups**
   ```bash
   # Add to crontab
   crontab -e
   
   # Daily backup at 2 AM
   0 2 * * * /opt/wa-gateway/scripts/backup-database.sh
   ```

## Common Commands

```bash
# View logs
make logs

# Restart services
make restart

# Run migrations
make migrate

# Backup database
make backup

# Health check
make health

# Generate code
make code-gen
```

## Troubleshooting

### Services not starting

```bash
# Check logs
make logs

# Check disk space
df -h

# Restart everything
make restart
```

### SSL certificate issues

```bash
# Regenerate certificates
make ssl

# Or manually
./scripts/generate-ssl.sh
```

### Database connection failed

```bash
# Check PostgreSQL
docker-compose exec postgres psql -U wagateway -c "SELECT 1;"

# Restart database
docker-compose restart postgres
```

### Port already in use

```bash
# Find process
sudo lsof -i :8000

# Kill process
sudo kill -9 <PID>
```

## DNS Configuration

Point these records to your server IP:

```
A     @              -> YOUR_SERVER_IP
A     www            -> YOUR_SERVER_IP
A     api            -> YOUR_SERVER_IP
A     evolution      -> YOUR_SERVER_IP
```

Verify:
```bash
dig yourdomain.com
```

## Firewall Configuration

```bash
# Allow required ports
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## Production Checklist

- [ ] Changed all default passwords
- [ ] Configured real payment gateway
- [ ] Setup SMTP email
- [ ] Configured backups
- [ ] Enabled firewall
- [ ] Setup monitoring alerts
- [ ] Tested all features
- [ ] Created documentation

## Support

- 📚 **Documentation:** [README.md](README.md)
- 💬 **Issues:** GitHub Issues
- 📧 **Email:** support@yourdomain.com

## License

MIT License

---

**🎉 Congratulations!** Your WhatsApp Gateway is now running!

Visit https://yourdomain.com to get started.
