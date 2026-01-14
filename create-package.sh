#!/bin/bash

# Package Deployment Script
# Creates a complete deployment package

set -e

VERSION="1.0.0"
PACKAGE_NAME="wa-gateway-deploy-${VERSION}"
OUTPUT_DIR="/mnt/user-data/outputs"

echo "📦 Creating deployment package..."
echo "Version: ${VERSION}"
echo ""

# Create package directory
TEMP_DIR=$(mktemp -d)
PACKAGE_DIR="${TEMP_DIR}/${PACKAGE_NAME}"
mkdir -p "${PACKAGE_DIR}"

# Copy all files
echo "Copying files..."
cp -r . "${PACKAGE_DIR}/"

# Clean up unnecessary files
echo "Cleaning up..."
cd "${PACKAGE_DIR}"
rm -rf .git
rm -rf node_modules
rm -rf backend/node_modules
rm -rf frontend/node_modules
rm -rf frontend/.next
rm -rf logs
rm -rf backups/*.tar.gz
rm -f .env

# Create checksums
echo "Creating checksums..."
cd "${TEMP_DIR}"
find "${PACKAGE_NAME}" -type f -exec sha256sum {} \; > "${PACKAGE_NAME}/CHECKSUMS.txt"

# Create archive
echo "Creating archive..."
tar czf "${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz" "${PACKAGE_NAME}"

# Calculate size
SIZE=$(du -h "${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz" | cut -f1)

# Create README for package
cat > "${OUTPUT_DIR}/PACKAGE-README.txt" << EOF
WhatsApp Gateway SaaS - Deployment Package
==========================================

Version: ${VERSION}
Created: $(date)
Size: ${SIZE}

Contents:
---------
- Complete source code (Backend, Frontend, Poller)
- Docker configuration
- Nginx configuration
- Deployment scripts
- Documentation

Quick Start:
-----------
1. Extract the package:
   tar xzf ${PACKAGE_NAME}.tar.gz
   cd ${PACKAGE_NAME}

2. Edit configuration:
   cp .env.example .env
   nano .env

3. Run deployment:
   sudo ./deploy.sh

For detailed instructions, see README.md

Requirements:
------------
- Ubuntu 20.04+ (or compatible Linux)
- 8GB RAM minimum (16GB recommended)
- 4 CPU cores minimum (8 cores recommended)
- 100GB storage
- Docker & Docker Compose
- Domain with DNS configured

Support:
--------
Documentation: See README.md
Issues: GitHub repository
Email: support@yourdomain.com

License: MIT
EOF

# Cleanup
rm -rf "${TEMP_DIR}"

echo ""
echo "✅ Package created successfully!"
echo ""
echo "📦 Package: ${OUTPUT_DIR}/${PACKAGE_NAME}.tar.gz"
echo "📄 README: ${OUTPUT_DIR}/PACKAGE-README.txt"
echo "📊 Size: ${SIZE}"
echo ""
echo "To deploy:"
echo "1. Download the package"
echo "2. Extract: tar xzf ${PACKAGE_NAME}.tar.gz"
echo "3. cd ${PACKAGE_NAME}"
echo "4. sudo ./deploy.sh"
echo ""
