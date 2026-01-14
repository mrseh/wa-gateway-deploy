#!/bin/bash

# Restart services script

SERVICE=${1:-"all"}

if [ "$SERVICE" = "all" ]; then
    echo "Restarting all services..."
    docker-compose restart
else
    echo "Restarting $SERVICE..."
    docker-compose restart $SERVICE
fi

echo "✓ Restart complete"
./scripts/health-check.sh
