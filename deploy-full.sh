#!/bin/bash
# WhatsApp Gateway - FULL DEPLOYMENT SCRIPT
# RUN THIS TO DEPLOY EVERYTHING!

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=========================================="
echo "WhatsApp Gateway - FULL DEPLOYMENT"
echo -e "==========================================${NC}"
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
   echo -e "${RED}Please run as root: sudo ./deploy-full.sh${NC}"
   exit 1
fi

# 1. CHECK PREREQUISITES
echo -e "${YELLOW}[1/10] Checking prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker not found! Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm get-docker.sh
    echo -e "${GREEN}✓ Docker installed${NC}"
else
    echo -e "${GREEN}✓ Docker found${NC}"
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose not found! Installing...${NC}"
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
    echo -e "${GREEN}✓ Docker Compose installed${NC}"
else
    echo -e "${GREEN}✓ Docker Compose found${NC}"
fi

# 2. CREATE ENVIRONMENT FILES
echo ""
echo -e "${YELLOW}[2/10] Creating environment files...${NC}"

cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=8000
APP_URL=https://yourdomain.com
DATABASE_URL=postgresql://wagateway:CHANGE_ME_PASSWORD@postgres:5432/wagateway
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=wagateway
POSTGRES_PASSWORD=CHANGE_ME_PASSWORD
POSTGRES_DB=wagateway
REDIS_URL=redis://:CHANGE_ME_REDIS@redis:6379
REDIS_PASSWORD=CHANGE_ME_REDIS
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=CHANGE_ME_INFLUX_TOKEN_64_CHARS_LONG
INFLUXDB_ORG=wagateway
INFLUXDB_BUCKET=pon_monitoring
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=CHANGE_ME_EVOLUTION_API_KEY
JWT_SECRET=CHANGE_ME_JWT_SECRET_MIN_32_CHARS
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com
MIDTRANS_SERVER_KEY=your-server-key
MIDTRANS_CLIENT_KEY=your-client-key
MIDTRANS_IS_PRODUCTION=false
EOF

cat > frontend/.env.production << 'EOF'
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
EOF

echo -e "${GREEN}✓ Environment files created${NC}"
echo -e "${YELLOW}⚠️  IMPORTANT: Edit backend/.env and change ALL passwords!${NC}"

read -p "Press Enter to continue after editing .env files, or Ctrl+C to exit..."

# 3. STOP EXISTING CONTAINERS
echo ""
echo -e "${YELLOW}[3/10] Stopping existing containers...${NC}"
docker-compose down 2>/dev/null || true
echo -e "${GREEN}✓ Stopped${NC}"

# 4. BUILD IMAGES
echo ""
echo -e "${YELLOW}[4/10] Building Docker images...${NC}"
docker-compose -f docker-compose.production.yml build --no-cache
echo -e "${GREEN}✓ Images built${NC}"

# 5. START DATABASE SERVICES
echo ""
echo -e "${YELLOW}[5/10] Starting database services...${NC}"
docker-compose -f docker-compose.production.yml up -d postgres redis influxdb
echo "Waiting 30 seconds for databases..."
sleep 30
echo -e "${GREEN}✓ Databases started${NC}"

# 6. RUN MIGRATIONS
echo ""
echo -e "${YELLOW}[6/10] Running database migrations...${NC}"
docker-compose -f docker-compose.production.yml run --rm api npm run migrate

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Migrations completed${NC}"
else
    echo -e "${RED}✗ Migrations failed!${NC}"
    echo "Check logs: docker-compose -f docker-compose.production.yml logs api"
    exit 1
fi

# 7. START ALL SERVICES
echo ""
echo -e "${YELLOW}[7/10] Starting all services...${NC}"
docker-compose -f docker-compose.production.yml up -d
echo "Waiting 60 seconds for services to start..."
sleep 60
echo -e "${GREEN}✓ All services started${NC}"

# 8. CHECK SERVICE HEALTH
echo ""
echo -e "${YELLOW}[8/10] Checking service health...${NC}"

# Check API
for i in {1..30}; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓ API is healthy${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}✗ API failed to start${NC}"
        docker-compose -f docker-compose.production.yml logs --tail=50 api
        exit 1
    fi
    echo "  Waiting for API... ($i/30)"
    sleep 2
done

# Check Evolution
if curl -f http://localhost:8080/instance/fetchInstances > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Evolution API is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Evolution API check failed (may still be starting)${NC}"
fi

# Check Frontend
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is healthy${NC}"
else
    echo -e "${YELLOW}⚠️  Frontend check failed (may still be starting)${NC}"
fi

# 9. CREATE DEFAULT PACKAGES
echo ""
echo -e "${YELLOW}[9/10] Creating default packages...${NC}"

docker-compose -f docker-compose.production.yml exec -T postgres psql -U wagateway -d wagateway << 'EOSQL'
INSERT INTO packages (id, name, price, max_instances, max_messages_per_day, max_olts, features, is_active, created_at, updated_at)
VALUES 
  ('pkg-trial', 'Trial', 0, 1, 100, 0, '{"bulk_messages": false, "olt_monitoring": false, "priority_support": false}'::jsonb, true, NOW(), NOW()),
  ('pkg-starter', 'Starter', 25000, 2, 1000, 0, '{"bulk_messages": true, "olt_monitoring": false, "priority_support": false}'::jsonb, true, NOW(), NOW()),
  ('pkg-professional', 'Professional', 75000, 5, 5000, 3, '{"bulk_messages": true, "olt_monitoring": true, "priority_support": true}'::jsonb, true, NOW(), NOW()),
  ('pkg-business', 'Business', 150000, 10, 20000, 10, '{"bulk_messages": true, "olt_monitoring": true, "priority_support": true, "custom_branding": true}'::jsonb, true, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
EOSQL

echo -e "${GREEN}✓ Default packages created${NC}"

# 10. SHOW STATUS
echo ""
echo -e "${YELLOW}[10/10] Deployment Status${NC}"
echo ""
docker-compose -f docker-compose.production.yml ps
echo ""

echo -e "${GREEN}=========================================="
echo "✅ DEPLOYMENT COMPLETED!"
echo -e "==========================================${NC}"
echo ""
echo -e "${GREEN}Access Points:${NC}"
echo "  Frontend:      http://localhost:3000"
echo "  Backend API:   http://localhost:8000"
echo "  Evolution API: http://localhost:8080"
echo "  MinIO Console: http://localhost:9001"
echo "  Grafana:       http://localhost:3001"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Access frontend: http://localhost:3000"
echo "2. Register your account"
echo "3. Create WhatsApp instance"
echo "4. Start sending messages!"
echo ""
echo -e "${YELLOW}Useful Commands:${NC}"
echo "  View logs:       docker-compose -f docker-compose.production.yml logs -f"
echo "  Restart service: docker-compose -f docker-compose.production.yml restart [service]"
echo "  Stop all:        docker-compose -f docker-compose.production.yml down"
echo ""
echo -e "${GREEN}🎉 WhatsApp Gateway is READY!${NC}"
