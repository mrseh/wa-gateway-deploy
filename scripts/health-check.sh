#!/bin/bash

# Health Check Script

echo "🏥 Running health checks..."

# Check services
services=("nginx" "frontend" "api" "evolution-api" "postgres" "redis")

for service in "${services[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo "✓ $service is running"
    else
        echo "✗ $service is NOT running"
    fi
done

# Check API health
echo ""
echo "Checking API health endpoint..."
curl -f http://localhost:8000/api/v1/health || echo "✗ API health check failed"

echo ""
echo "Health check complete!"
