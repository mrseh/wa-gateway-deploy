#!/bin/bash
# Restore from Backup
# Usage: ./restore.sh <backup_date>

set -e

LOG_FILE="/var/log/wa-gateway-restore.log"

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

if [ -z "$1" ]; then
    echo "Usage: ./restore.sh <backup_date>"
    echo ""
    echo "Available backups:"
    ls -la /backups/ | grep "^d" | awk '{print $NF}' | grep "^20"
    exit 1
fi

BACKUP_DATE=$1
BACKUP_DIR="/backups/$BACKUP_DATE"

if [ ! -d "$BACKUP_DIR" ]; then
    echo "Error: Backup not found: $BACKUP_DIR"
    exit 1
fi

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

log "=========================================="
log "Restoring from backup: $BACKUP_DATE"
log "=========================================="

# Confirmation
read -p "⚠️  This will OVERWRITE current data. Continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    log "Restore cancelled by user"
    exit 0
fi

# Stop services
log "Stopping services..."
docker-compose down

# Wait for services to stop
sleep 5

# Start database services
log "Starting database services..."
docker-compose up -d postgres redis influxdb

# Wait for databases to be ready
log "Waiting for databases to be ready..."
sleep 15

# Restore PostgreSQL
if [ -f "$BACKUP_DIR/postgres_$BACKUP_DATE.sql.gz" ]; then
    log "Restoring PostgreSQL..."
    
    # Drop existing connections
    docker-compose exec -T postgres psql -U ${POSTGRES_USER} -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}';" || true
    
    # Restore
    gunzip -c $BACKUP_DIR/postgres_$BACKUP_DATE.sql.gz | \
        docker-compose exec -T postgres psql -U ${POSTGRES_USER}
    
    if [ $? -eq 0 ]; then
        log "✓ PostgreSQL restore completed"
    else
        log "✗ PostgreSQL restore failed"
        exit 1
    fi
else
    log "⚠ PostgreSQL backup file not found"
fi

# Restore Redis
if [ -f "$BACKUP_DIR/redis_$BACKUP_DATE.rdb" ]; then
    log "Restoring Redis..."
    
    docker-compose stop redis
    docker cp $BACKUP_DIR/redis_$BACKUP_DATE.rdb $(docker-compose ps -q redis):/data/dump.rdb
    docker-compose start redis
    
    sleep 5
    
    if [ $? -eq 0 ]; then
        log "✓ Redis restore completed"
    else
        log "✗ Redis restore failed"
    fi
else
    log "⚠ Redis backup file not found"
fi

# Restore InfluxDB
if [ -d "$BACKUP_DIR/influxdb_$BACKUP_DATE" ]; then
    log "Restoring InfluxDB..."
    
    docker cp $BACKUP_DIR/influxdb_$BACKUP_DATE $(docker-compose ps -q influxdb):/tmp/influx_backup
    docker-compose exec -T influxdb influx restore /tmp/influx_backup -t ${INFLUXDB_TOKEN} --full
    
    if [ $? -eq 0 ]; then
        log "✓ InfluxDB restore completed"
    else
        log "⚠ InfluxDB restore failed (may already exist)"
    fi
else
    log "⚠ InfluxDB backup not found"
fi

# Start MinIO
docker-compose up -d minio
sleep 10

# Restore MinIO
if [ -d "$BACKUP_DIR/minio_$BACKUP_DATE" ]; then
    log "Restoring MinIO..."
    
    docker cp $BACKUP_DIR/minio_$BACKUP_DATE $(docker-compose ps -q minio):/data
    
    if [ $? -eq 0 ]; then
        log "✓ MinIO restore completed"
    else
        log "⚠ MinIO restore failed"
    fi
else
    log "⚠ MinIO backup not found"
fi

# Start Evolution API
docker-compose up -d evolution-api
sleep 10

# Restore Evolution instances
if [ -d "$BACKUP_DIR/evolution_instances" ]; then
    log "Restoring Evolution instances..."
    
    docker cp $BACKUP_DIR/evolution_instances $(docker-compose ps -q evolution-api):/evolution/
    
    if [ $? -eq 0 ]; then
        log "✓ Evolution instances restore completed"
    else
        log "⚠ Evolution instances restore failed"
    fi
else
    log "⚠ Evolution instances backup not found"
fi

# Restore application files (optional)
if [ -f "$BACKUP_DIR/app_files_$BACKUP_DATE.tar.gz" ]; then
    read -p "Restore application files (.env, configs)? (yes/no): " restore_files
    
    if [ "$restore_files" = "yes" ]; then
        log "Restoring application files..."
        tar -xzf $BACKUP_DIR/app_files_$BACKUP_DATE.tar.gz
        log "✓ Application files restored"
    fi
fi

# Start all services
log "Starting all services..."
docker-compose up -d

# Wait for services
log "Waiting for services to start..."
sleep 30

# Health check
log "Running health checks..."
HEALTH_CHECK=$(curl -f http://localhost:8000/health 2>/dev/null || echo "failed")

if [[ $HEALTH_CHECK == *"ok"* ]]; then
    log "✓ API health check passed"
else
    log "⚠ API health check failed - service may still be starting"
fi

log "=========================================="
log "Restore completed!"
log "=========================================="
log ""
log "Please verify:"
log "1. Check service logs: docker-compose logs -f"
log "2. Test frontend: https://yourdomain.com"
log "3. Test API: https://api.yourdomain.com/health"
log "4. Check database connections"
log "5. Verify Evolution instances"
log ""
log "=========================================="

exit 0
