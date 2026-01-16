#!/bin/bash
# START SCRIPT - Run this to start WhatsApp Gateway
# Usage: ./START.sh

set -e

echo "==========================================="
echo "WhatsApp Gateway - Starting..."
echo "==========================================="

# Check Docker
if ! docker ps > /dev/null 2>&1; then
    echo "ERROR: Docker is not running!"
    echo "Please start Docker first"
    exit 1
fi

# Check if .env exists
if [ ! -f backend/.env ]; then
    echo "Creating backend/.env from example..."
    cp backend/.env.example backend/.env
    echo "⚠️  Please edit backend/.env and set your passwords!"
    echo "Then run this script again."
    exit 1
fi

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down 2>/dev/null || true

# Start services
echo "Starting services..."
docker-compose up -d

# Wait for database
echo "Waiting for database (30 seconds)..."
sleep 30

# Run migrations
echo "Running database migrations..."
docker-compose exec -T api npm run migrate || {
    echo "⚠️  Migrations may have already run"
}

# Show status
echo ""
echo "==========================================="
echo "Services Status:"
docker-compose ps

# Test API
echo ""
echo "Testing API..."
sleep 5
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ API is running"
else
    echo "✗ API is not responding yet (wait a bit more)"
fi

echo ""
echo "==========================================="
echo "✓ Started!"
echo "==========================================="
echo ""
echo "Access:"
echo "  Frontend: http://localhost:3000"
echo "  API:      http://localhost:8000"
echo ""
echo "Commands:"
echo "  Logs:     docker-compose logs -f"
echo "  Stop:     docker-compose down"
echo "  Restart:  docker-compose restart [service]"
echo ""
