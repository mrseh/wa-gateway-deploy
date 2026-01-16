#!/bin/bash

set -e

echo "🚀 WhatsApp Gateway SaaS - Deployment Script"
echo "============================================="
echo ""

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "Please run as root: sudo ./deploy.sh"
    exit 1
fi

# Install Docker
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Check .env
if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.example .env
    
    # Generate secrets
    JWT_SECRET=$(openssl rand -base64 32)
    REFRESH_SECRET=$(openssl rand -base64 32)
    EVOLUTION_KEY=$(openssl rand -base64 16 | tr -d '=')
    
    sed -i "s/CHANGE_THIS_JWT_SECRET_MIN_32_CHARACTERS_789/$JWT_SECRET/" .env
    sed -i "s/CHANGE_THIS_REFRESH_SECRET_MIN_32_CHARACTERS_012/$REFRESH_SECRET/" .env
    sed -i "s/CHANGE_THIS_EVOLUTION_API_KEY_345/$EVOLUTION_KEY/" .env
    
    echo ""
    echo "⚠️  IMPORTANT: Edit .env and update:"
    echo "   - DOMAIN"
    echo "   - Database passwords"
    echo "   - Email configuration"
    echo "   - Payment gateway credentials"
    echo ""
    read -p "Press Enter when ready to continue..."
fi

echo "Starting deployment..."

# Pull images
docker-compose pull

# Build custom images
docker-compose build

# Start databases
docker-compose up -d postgres redis influxdb minio
echo "Waiting for databases..."
sleep 20

# Start API
docker-compose up -d api
sleep 10

# Run migrations
docker-compose exec api npx prisma migrate deploy

# Start all services
docker-compose up -d

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Access your application:"
echo "  Frontend:  https://$(grep DOMAIN .env | cut -d= -f2)"
echo "  API:       https://api.$(grep DOMAIN .env | cut -d= -f2)"
echo "  Grafana:   http://localhost:3001"
echo ""
echo "Check status: docker-compose ps"
echo "View logs:    docker-compose logs -f"
echo ""
