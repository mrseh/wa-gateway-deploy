#!/bin/bash
# SSL Certificate Setup with Let's Encrypt
# Usage: ./setup-ssl.sh yourdomain.com admin@yourdomain.com

set -e

DOMAIN=${1:-"yourdomain.com"}
EMAIL=${2:-"admin@yourdomain.com"}
SUBDOMAINS="www.$DOMAIN,api.$DOMAIN,evolution.$DOMAIN"

echo "=========================================="
echo "SSL Certificate Setup"
echo "=========================================="
echo "Domain: $DOMAIN"
echo "Subdomains: $SUBDOMAINS"
echo "Email: $EMAIL"
echo "=========================================="

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root" 
   exit 1
fi

# Create directories
mkdir -p certbot/conf certbot/www

# Stop nginx temporarily
echo "Stopping nginx..."
docker-compose -f docker-compose.yml stop nginx || true

# Check if certificates already exist
if [ -d "certbot/conf/live/$DOMAIN" ]; then
    echo "Certificates already exist for $DOMAIN"
    read -p "Do you want to renew them? (yes/no): " renew
    
    if [ "$renew" != "yes" ]; then
        echo "Keeping existing certificates"
        docker-compose -f docker-compose.yml start nginx
        exit 0
    fi
    
    # Renew existing certificates
    echo "Renewing certificates..."
    docker run -it --rm \
      -v $(pwd)/certbot/conf:/etc/letsencrypt \
      -v $(pwd)/certbot/www:/var/www/certbot \
      certbot/certbot renew
else
    # Get new certificates
    echo "Obtaining new certificates..."
    docker run -it --rm \
      -v $(pwd)/certbot/conf:/etc/letsencrypt \
      -v $(pwd)/certbot/www:/var/www/certbot \
      -p 80:80 \
      certbot/certbot certonly \
      --standalone \
      --email $EMAIL \
      --agree-tos \
      --no-eff-email \
      --force-renewal \
      -d $DOMAIN \
      -d $SUBDOMAINS
fi

# Check if certificates were created
if [ ! -f "certbot/conf/live/$DOMAIN/fullchain.pem" ]; then
    echo "Error: Certificates not created"
    exit 1
fi

echo "✓ SSL certificates obtained successfully!"
echo "Certificates location: $(pwd)/certbot/conf/live/$DOMAIN/"

# Update nginx config with actual domain
echo "Updating nginx configuration..."
sed -i "s/yourdomain.com/$DOMAIN/g" nginx/nginx.conf

# Start nginx
echo "Starting nginx..."
docker-compose -f docker-compose.yml start nginx

# Setup auto-renewal cron job
echo "Setting up auto-renewal..."
CRON_CMD="0 3 * * * cd $(pwd) && docker-compose -f docker-compose.yml run --rm certbot renew && docker-compose -f docker-compose.yml exec nginx nginx -s reload"

# Check if cron job already exists
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "$CRON_CMD") | crontab -
    echo "✓ Auto-renewal cron job added (runs daily at 3 AM)"
else
    echo "✓ Auto-renewal cron job already exists"
fi

# Test nginx configuration
echo "Testing nginx configuration..."
docker-compose -f docker-compose.yml exec nginx nginx -t

echo ""
echo "=========================================="
echo "SSL Setup Completed!"
echo "=========================================="
echo "Your site is now secured with HTTPS:"
echo "  - https://$DOMAIN"
echo "  - https://www.$DOMAIN"
echo "  - https://api.$DOMAIN"
echo "  - https://evolution.$DOMAIN"
echo ""
echo "Certificates will auto-renew daily at 3 AM"
echo "=========================================="
