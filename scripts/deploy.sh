#!/bin/bash
# Production Deployment Script
# Automated deployment with zero downtime

set -e

LOG_FILE="/var/log/wa-gateway-deploy.log"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

echo "=========================================="
echo "WhatsApp Gateway - Production Deployment"
echo "=========================================="

# Configuration
COMPOSE_FILE="docker-compose.yml"
BACKUP_BEFORE_DEPLOY=true
RUN_MIGRATIONS=true
HEALTH_CHECK_RETRIES=30
HEALTH_CHECK_INTERVAL=2

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   log "⚠️  Warning: Not running as root. Some operations may fail."
fi

# Check if .env exists
if [ ! -f .env ]; then
    log "❌ Error: .env file not found!"
    echo "Please create .env file from .env.example"
    exit 1
fi

# Load environment variables
source .env

log "Starting deployment process..."

# Pre-deployment checks
log "Running pre-deployment checks..."

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    log "⚠️  Warning: Disk usage is ${DISK_USAGE}%"
    read -p "Continue anyway? (yes/no): " continue
    if [ "$continue" != "yes" ]; then
        log "Deployment cancelled due to disk space"
        exit 1
    fi
fi

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    log "❌ Error: Docker is not running"
    exit 1
fi
log "✓ Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    log "❌ Error: docker-compose not found"
    exit 1
fi
log "✓ docker-compose is available"

# Backup current database
if [ "$BACKUP_BEFORE_DEPLOY" = true ]; then
    log "Creating backup before deployment..."
    if [ -f "./scripts/backup.sh" ]; then
        ./scripts/backup.sh
        log "✓ Backup completed"
    else
        log "⚠️  Backup script not found, skipping backup"
    fi
fi

# Pull latest images
log "Pulling latest Docker images..."
docker-compose -f $COMPOSE_FILE pull

if [ $? -eq 0 ]; then
    log "✓ Images pulled successfully"
else
    log "❌ Failed to pull images"
    exit 1
fi

# Stop application services (keep databases running)
log "Stopping application services..."
docker-compose -f $COMPOSE_FILE stop api frontend evolution-api pon-poller

# Run database migrations
if [ "$RUN_MIGRATIONS" = true ]; then
    log "Running database migrations..."
    
    docker-compose -f $COMPOSE_FILE run --rm api npm run migrate
    
    if [ $? -eq 0 ]; then
        log "✓ Migrations completed successfully"
    else
        log "❌ Migrations failed"
        log "Rolling back..."
        docker-compose -f $COMPOSE_FILE up -d
        exit 1
    fi
fi

# Build and start services
log "Starting services..."
docker-compose -f $COMPOSE_FILE up -d --build

# Wait for services to be ready
log "Waiting for services to be ready..."
sleep 10

# Health check
log "Running health checks..."
RETRY_COUNT=0
HEALTH_OK=false

while [ $RETRY_COUNT -lt $HEALTH_CHECK_RETRIES ]; do
    HEALTH_RESPONSE=$(curl -f http://localhost:8000/health 2>/dev/null || echo "failed")
    
    if [[ $HEALTH_RESPONSE == *"ok"* ]]; then
        log "✓ API health check passed"
        HEALTH_OK=true
        break
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    log "⏳ Waiting for API to be ready... ($RETRY_COUNT/$HEALTH_CHECK_RETRIES)"
    sleep $HEALTH_CHECK_INTERVAL
done

if [ "$HEALTH_OK" = false ]; then
    log "❌ API failed to start within timeout"
    log "Checking logs..."
    docker-compose -f $COMPOSE_FILE logs --tail=50 api
    
    log "Rolling back..."
    docker-compose -f $COMPOSE_FILE down
    docker-compose -f $COMPOSE_FILE up -d
    
    exit 1
fi

# Check Evolution API
log "Checking Evolution API..."
EVOLUTION_RESPONSE=$(curl -f http://localhost:8080/instance/fetchInstances 2>/dev/null || echo "failed")

if [[ $EVOLUTION_RESPONSE != "failed" ]]; then
    log "✓ Evolution API is healthy"
else
    log "⚠️  Evolution API check failed (may still be starting)"
fi

# Check frontend
log "Checking frontend..."
FRONTEND_RESPONSE=$(curl -f http://localhost:3000 2>/dev/null || echo "failed")

if [[ $FRONTEND_RESPONSE != "failed" ]]; then
    log "✓ Frontend is healthy"
else
    log "⚠️  Frontend check failed (may still be starting)"
fi

# Cleanup old images
log "Cleaning up old Docker images..."
docker image prune -f
log "✓ Cleanup completed"

# Display service status
log ""
log "=========================================="
log "Deployment completed successfully!"
log "=========================================="
log ""
log "Service Status:"
docker-compose -f $COMPOSE_FILE ps
log ""
log "=========================================="
log "Access your application:"
log "  Frontend: https://yourdomain.com"
log "  API: https://api.yourdomain.com"
log "  API Health: https://api.yourdomain.com/health"
log "  Evolution: https://evolution.yourdomain.com"
log "  Grafana: http://$(hostname -I | awk '{print $1}'):3001"
log "  Prometheus: http://$(hostname -I | awk '{print $1}'):9090"
log ""
log "Useful commands:"
log "  View logs: docker-compose -f $COMPOSE_FILE logs -f [service]"
log "  Restart service: docker-compose -f $COMPOSE_FILE restart [service]"
log "  Check status: docker-compose -f $COMPOSE_FILE ps"
log "=========================================="

# Send deployment notification (if webhook configured)
if [ ! -z "$DEPLOYMENT_WEBHOOK" ]; then
    curl -X POST $DEPLOYMENT_WEBHOOK \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"✓ Deployment completed successfully\nTime: $(date)\"}" \
        > /dev/null 2>&1 || true
fi

exit 0
