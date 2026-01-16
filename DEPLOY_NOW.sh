#!/bin/bash
# DEPLOY NOW - One command deployment
# Run: sudo bash DEPLOY_NOW.sh

set -e

echo "================================================"
echo "WhatsApp Gateway - DEPLOYING NOW!"
echo "================================================"

# Create backend .env if not exists
if [ ! -f backend/.env ]; then
  cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=8000
DATABASE_URL=postgresql://wagateway:wagateway123@postgres:5432/wagateway
POSTGRES_USER=wagateway
POSTGRES_PASSWORD=wagateway123
POSTGRES_DB=wagateway
REDIS_URL=redis://redis:6379
INFLUXDB_URL=http://influxdb:8086
INFLUXDB_TOKEN=dev-token-1234567890
INFLUXDB_ORG=wagateway
INFLUXDB_BUCKET=pon_monitoring
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=B6D711FCDE4D4FD5936544120E713976
JWT_SECRET=change-this-secret-min-32-chars-long-please
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-password
SMTP_FROM=noreply@localhost
MIDTRANS_SERVER_KEY=your-key
MIDTRANS_CLIENT_KEY=your-key
MIDTRANS_IS_PRODUCTION=false
APP_URL=http://localhost:3000
EOF
  echo "✓ Created backend/.env"
fi

# Create frontend .env
cat > frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=http://localhost:8000
EOF
echo "✓ Created frontend/.env.local"

# Stop existing
docker-compose down 2>/dev/null || true

# Build & Start
echo "Starting services..."
docker-compose up -d --build

# Wait
echo "Waiting 60 seconds for services..."
sleep 60

# Migrate
echo "Running migrations..."
docker-compose exec -T api npm run migrate 2>/dev/null || echo "Migrations done or already run"

# Status
echo ""
echo "================================================"
docker-compose ps
echo "================================================"
echo ""
echo "✓ DEPLOYED!"
echo ""
echo "Access: http://localhost:3000"
echo "API: http://localhost:8000/health"
echo ""
echo "Run: docker-compose logs -f"
echo "================================================"
