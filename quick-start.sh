#!/bin/bash

# Quick Start Script for Development

set -e

echo "🚀 WhatsApp Gateway SaaS - Quick Start"
echo ""

# Check if .env exists
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
    
    echo "✓ Environment file created with generated secrets"
    echo ""
    echo "⚠️  Please edit .env and update:"
    echo "   - Domain name"
    echo "   - Database passwords"
    echo "   - Payment gateway credentials"
    echo "   - Email configuration"
    echo ""
    read -p "Press Enter when ready to continue..."
fi

# Start databases first
echo "Starting databases..."
docker-compose up -d postgres redis influxdb minio

echo "Waiting for databases to be ready..."
sleep 15

# Run migrations
echo "Running database migrations..."
docker-compose run --rm api npx prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
docker-compose run --rm api npx prisma generate

# Start all services
echo "Starting all services..."
docker-compose up -d

echo ""
echo "✓ All services started!"
echo ""
echo "🌐 Access points:"
echo "   Frontend:  http://localhost:3000"
echo "   API:       http://localhost:8000"
echo "   Evolution: http://localhost:8080"
echo "   Grafana:   http://localhost:3001"
echo ""
echo "📊 View logs: ./scripts/logs.sh [service-name]"
echo "🏥 Health check: ./scripts/health-check.sh"
echo ""
