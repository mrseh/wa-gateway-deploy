#!/bin/bash

# Backup Script for WhatsApp Gateway SaaS
# This script creates backups of the database, volumes, and configuration

set -e

# Configuration
BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_NAME="wa_gateway_backup_${TIMESTAMP}"
RETENTION_DAYS=30

# Source environment
if [ -f .env ]; then
    source .env
else
    echo "Error: .env file not found"
    exit 1
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}Starting backup: ${BACKUP_NAME}${NC}"

# Create backup directory
mkdir -p "${BACKUP_DIR}/${BACKUP_NAME}"

# 1. Backup PostgreSQL database
echo "Backing up PostgreSQL database..."
docker-compose exec -T postgres pg_dump -U ${POSTGRES_USER} ${POSTGRES_DB} | gzip > "${BACKUP_DIR}/${BACKUP_NAME}/postgres.sql.gz"
echo -e "${GREEN}✓ PostgreSQL backup completed${NC}"

# 2. Backup Evolution API data
echo "Backing up Evolution API data..."
docker-compose exec -T evolution-api tar czf - /evolution/instances /evolution/store 2>/dev/null | cat > "${BACKUP_DIR}/${BACKUP_NAME}/evolution.tar.gz" || true
echo -e "${GREEN}✓ Evolution API backup completed${NC}"

# 3. Backup InfluxDB
echo "Backing up InfluxDB..."
docker-compose exec -T influxdb influx backup /tmp/influx-backup -t ${INFLUXDB_TOKEN} 2>/dev/null || true
docker cp wa_gateway_influxdb:/tmp/influx-backup "${BACKUP_DIR}/${BACKUP_NAME}/influxdb" || true
echo -e "${GREEN}✓ InfluxDB backup completed${NC}"

# 4. Backup configuration files
echo "Backing up configuration files..."
tar czf "${BACKUP_DIR}/${BACKUP_NAME}/config.tar.gz" \
    .env \
    docker-compose.yml \
    nginx/nginx.conf \
    prometheus/prometheus.yml 2>/dev/null || true
echo -e "${GREEN}✓ Configuration backup completed${NC}"

# 5. Create backup manifest
cat > "${BACKUP_DIR}/${BACKUP_NAME}/manifest.txt" << EOF
Backup Date: $(date)
Backup Name: ${BACKUP_NAME}
Components:
- PostgreSQL Database
- Evolution API Data
- InfluxDB
- Configuration Files

Retention: ${RETENTION_DAYS} days
EOF

# Create compressed archive
echo "Creating compressed archive..."
cd "${BACKUP_DIR}"
tar czf "${BACKUP_NAME}.tar.gz" "${BACKUP_NAME}"
rm -rf "${BACKUP_NAME}"

echo -e "${GREEN}✓ Backup completed: ${BACKUP_DIR}/${BACKUP_NAME}.tar.gz${NC}"

# Calculate size
SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" | cut -f1)
echo "Backup size: ${SIZE}"

# Cleanup old backups
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "${BACKUP_DIR}" -name "wa_gateway_backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete
echo -e "${GREEN}✓ Old backups cleaned${NC}"

# Optional: Upload to S3 (if configured)
if [ ! -z "${BACKUP_S3_BUCKET}" ]; then
    echo "Uploading to S3..."
    aws s3 cp "${BACKUP_DIR}/${BACKUP_NAME}.tar.gz" "s3://${BACKUP_S3_BUCKET}/backups/" 2>/dev/null && \
        echo -e "${GREEN}✓ Uploaded to S3${NC}" || \
        echo -e "${YELLOW}⚠ S3 upload failed${NC}"
fi

echo -e "${GREEN}Backup completed successfully!${NC}"
