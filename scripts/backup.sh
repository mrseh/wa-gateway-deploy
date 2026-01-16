#!/bin/bash
# Automated Backup Script
# Backs up PostgreSQL, Redis, InfluxDB, MinIO, and Evolution instances

set -e

BACKUP_DIR="/backups"
DATE=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=30
LOG_FILE="/var/log/wa-gateway-backup.log"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Logging function
log() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "=========================================="
log "Starting backup at $(date)"
log "=========================================="

# Create backup directory
mkdir -p $BACKUP_DIR/$DATE

# Backup PostgreSQL
log "Backing up PostgreSQL..."
docker-compose exec -T postgres pg_dumpall -U ${POSTGRES_USER} | gzip > $BACKUP_DIR/$DATE/postgres_$DATE.sql.gz

if [ $? -eq 0 ]; then
    log "✓ PostgreSQL backup completed"
    POSTGRES_SIZE=$(du -sh $BACKUP_DIR/$DATE/postgres_$DATE.sql.gz | cut -f1)
    log "  Size: $POSTGRES_SIZE"
else
    log "✗ PostgreSQL backup failed"
fi

# Backup Redis
log "Backing up Redis..."
docker-compose exec -T redis redis-cli --no-auth-warning --pass ${REDIS_PASSWORD} SAVE
docker cp $(docker-compose ps -q redis):/data/dump.rdb $BACKUP_DIR/$DATE/redis_$DATE.rdb

if [ $? -eq 0 ]; then
    log "✓ Redis backup completed"
    REDIS_SIZE=$(du -sh $BACKUP_DIR/$DATE/redis_$DATE.rdb | cut -f1)
    log "  Size: $REDIS_SIZE"
else
    log "✗ Redis backup failed"
fi

# Backup InfluxDB
log "Backing up InfluxDB..."
docker-compose exec -T influxdb influx backup /tmp/influx_backup -t ${INFLUXDB_TOKEN}
docker cp $(docker-compose ps -q influxdb):/tmp/influx_backup $BACKUP_DIR/$DATE/influxdb_$DATE

if [ $? -eq 0 ]; then
    log "✓ InfluxDB backup completed"
    INFLUX_SIZE=$(du -sh $BACKUP_DIR/$DATE/influxdb_$DATE | cut -f1)
    log "  Size: $INFLUX_SIZE"
else
    log "✗ InfluxDB backup failed"
fi

# Backup MinIO (Evolution API media)
log "Backing up MinIO..."
docker-compose exec -T minio mc mirror --overwrite /data $BACKUP_DIR/$DATE/minio_$DATE 2>/dev/null || true

if [ -d "$BACKUP_DIR/$DATE/minio_$DATE" ]; then
    log "✓ MinIO backup completed"
    MINIO_SIZE=$(du -sh $BACKUP_DIR/$DATE/minio_$DATE | cut -f1)
    log "  Size: $MINIO_SIZE"
else
    log "⚠ MinIO backup skipped or empty"
fi

# Backup Evolution API instances
log "Backing up Evolution API instances..."
docker cp $(docker-compose ps -q evolution-api):/evolution/instances $BACKUP_DIR/$DATE/evolution_instances 2>/dev/null || true

if [ -d "$BACKUP_DIR/$DATE/evolution_instances" ]; then
    log "✓ Evolution instances backup completed"
    EVOLUTION_SIZE=$(du -sh $BACKUP_DIR/$DATE/evolution_instances | cut -f1)
    log "  Size: $EVOLUTION_SIZE"
else
    log "⚠ Evolution instances backup skipped or empty"
fi

# Backup application files
log "Backing up application files..."
tar -czf $BACKUP_DIR/$DATE/app_files_$DATE.tar.gz \
    .env \
    docker-compose.yml \
    nginx/ \
    --exclude='*.log' \
    --exclude='node_modules' 2>/dev/null || true

if [ -f "$BACKUP_DIR/$DATE/app_files_$DATE.tar.gz" ]; then
    log "✓ Application files backup completed"
    APP_SIZE=$(du -sh $BACKUP_DIR/$DATE/app_files_$DATE.tar.gz | cut -f1)
    log "  Size: $APP_SIZE"
else
    log "✗ Application files backup failed"
fi

# Create backup manifest
cat > $BACKUP_DIR/$DATE/manifest.json <<EOF
{
  "date": "$DATE",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "components": [
    "postgres",
    "redis",
    "influxdb",
    "minio",
    "evolution_instances",
    "app_files"
  ],
  "sizes": {
    "postgres": "${POSTGRES_SIZE:-N/A}",
    "redis": "${REDIS_SIZE:-N/A}",
    "influxdb": "${INFLUX_SIZE:-N/A}",
    "minio": "${MINIO_SIZE:-N/A}",
    "evolution": "${EVOLUTION_SIZE:-N/A}",
    "app_files": "${APP_SIZE:-N/A}"
  },
  "total_size": "$(du -sh $BACKUP_DIR/$DATE | cut -f1)"
}
EOF

log "✓ Backup manifest created"

TOTAL_SIZE=$(du -sh $BACKUP_DIR/$DATE | cut -f1)
log "Backup completed: $BACKUP_DIR/$DATE"
log "Total size: $TOTAL_SIZE"

# Upload to cloud storage (if configured)
if [ ! -z "$S3_BACKUP_BUCKET" ]; then
    log "Uploading to S3..."
    aws s3 sync $BACKUP_DIR/$DATE s3://$S3_BACKUP_BUCKET/backups/$DATE/ --storage-class STANDARD_IA
    
    if [ $? -eq 0 ]; then
        log "✓ Uploaded to S3: s3://$S3_BACKUP_BUCKET/backups/$DATE/"
    else
        log "✗ S3 upload failed"
    fi
fi

# Upload to Google Cloud Storage (if configured)
if [ ! -z "$GCS_BACKUP_BUCKET" ]; then
    log "Uploading to Google Cloud Storage..."
    gsutil -m rsync -r $BACKUP_DIR/$DATE gs://$GCS_BACKUP_BUCKET/backups/$DATE/
    
    if [ $? -eq 0 ]; then
        log "✓ Uploaded to GCS: gs://$GCS_BACKUP_BUCKET/backups/$DATE/"
    else
        log "✗ GCS upload failed"
    fi
fi

# Remove old backups
log "Removing backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -type d -name "2*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
log "✓ Old backups cleaned up"

# Send notification (if webhook configured)
if [ ! -z "$BACKUP_NOTIFICATION_WEBHOOK" ]; then
    curl -X POST $BACKUP_NOTIFICATION_WEBHOOK \
        -H "Content-Type: application/json" \
        -d "{\"text\":\"✓ Backup completed: $DATE\nSize: $TOTAL_SIZE\"}" \
        > /dev/null 2>&1 || true
fi

log "=========================================="
log "Backup process completed successfully!"
log "=========================================="

# Exit with success
exit 0
