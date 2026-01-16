#!/bin/bash
echo "Checking services..."

services=("nginx" "frontend" "api" "evolution-api" "postgres" "redis")

for service in "${services[@]}"; do
    if docker-compose ps | grep -q "$service.*Up"; then
        echo "✓ $service is running"
    else
        echo "✗ $service is NOT running"
    fi
done

curl -sf http://localhost:8000/api/v1/health > /dev/null && echo "✓ API health OK" || echo "✗ API health failed"
