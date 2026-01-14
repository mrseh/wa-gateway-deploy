#!/bin/bash

# SSL Certificate Generation Script

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}SSL Certificate Generation${NC}"
echo ""

# Load environment
if [ -f .env ]; then
    source .env
else
    echo -e "${RED}Error: .env file not found${NC}"
    exit 1
fi

# Check if domain is set
if [ -z "$DOMAIN" ]; then
    echo -e "${RED}Error: DOMAIN not set in .env${NC}"
    exit 1
fi

if [ -z "$EMAIL" ]; then
    echo -e "${RED}Error: EMAIL not set in .env${NC}"
    exit 1
fi

echo "Domain: $DOMAIN"
echo "Email: $EMAIL"
echo ""

# Ask for method
echo "Choose SSL certificate method:"
echo "1) Let's Encrypt (Production - Recommended)"
echo "2) Self-Signed (Development/Testing only)"
echo ""
read -p "Enter choice [1-2]: " choice

case $choice in
    1)
        echo -e "${BLUE}Generating Let's Encrypt SSL certificates...${NC}"
        
        # Create directories
        mkdir -p certbot/conf certbot/www
        
        # Check if Nginx is running
        if ! docker-compose ps nginx | grep -q "Up"; then
            echo "Starting Nginx for certificate validation..."
            docker-compose up -d nginx
            sleep 5
        fi
        
        # Generate certificates
        docker-compose run --rm certbot certonly \
            --webroot \
            --webroot-path=/var/www/certbot \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            --force-renewal \
            -d $DOMAIN \
            -d www.$DOMAIN \
            -d api.$DOMAIN \
            -d evolution.$DOMAIN
        
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓ SSL certificates generated successfully${NC}"
            echo ""
            echo "Certificates location: ./certbot/conf/live/$DOMAIN/"
            echo ""
            echo "Certificate will auto-renew. No action needed."
            
            # Reload Nginx
            echo "Reloading Nginx..."
            docker-compose restart nginx
            
            echo -e "${GREEN}✓ Done!${NC}"
        else
            echo -e "${RED}✗ Certificate generation failed${NC}"
            echo ""
            echo "Possible issues:"
            echo "1. DNS not properly configured"
            echo "2. Port 80 not accessible"
            echo "3. Domain already has certificates"
            echo ""
            echo "Verify DNS:"
            echo "  dig $DOMAIN"
            echo "  dig api.$DOMAIN"
            exit 1
        fi
        ;;
        
    2)
        echo -e "${YELLOW}Generating self-signed SSL certificates...${NC}"
        echo -e "${YELLOW}WARNING: Only use this for development/testing!${NC}"
        echo ""
        
        # Create directory
        mkdir -p nginx/ssl
        
        # Generate certificate
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout nginx/ssl/privkey.pem \
            -out nginx/ssl/fullchain.pem \
            -subj "/C=ID/ST=Jakarta/L=Jakarta/O=WA Gateway/CN=$DOMAIN"
        
        # Create chain
        cp nginx/ssl/fullchain.pem nginx/ssl/chain.pem
        
        echo -e "${GREEN}✓ Self-signed certificate generated${NC}"
        echo ""
        echo "Certificate location: ./nginx/ssl/"
        echo ""
        echo -e "${YELLOW}Note: Browsers will show security warning${NC}"
        echo ""
        
        # Update nginx config to use self-signed
        sed -i "s|/etc/letsencrypt/live/${DOMAIN}/|/etc/nginx/ssl/|g" nginx/nginx.conf
        
        # Reload Nginx
        if docker-compose ps nginx | grep -q "Up"; then
            echo "Reloading Nginx..."
            docker-compose restart nginx
        fi
        
        echo -e "${GREEN}✓ Done!${NC}"
        ;;
        
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo "Test SSL:"
echo "  curl -I https://$DOMAIN"
echo "  openssl s_client -connect $DOMAIN:443"
