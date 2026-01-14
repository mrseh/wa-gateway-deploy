#!/bin/bash

# WhatsApp Gateway SaaS - Deployment Script
# This script automates the deployment process

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then 
        print_error "Please run as root or with sudo"
        exit 1
    fi
}

# Install Docker
install_docker() {
    print_header "Installing Docker"
    
    if command -v docker &> /dev/null; then
        print_success "Docker already installed"
        docker --version
    else
        print_info "Installing Docker..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sh get-docker.sh
        rm get-docker.sh
        
        # Start and enable Docker
        systemctl start docker
        systemctl enable docker
        
        print_success "Docker installed successfully"
    fi
}

# Install Docker Compose
install_docker_compose() {
    print_header "Installing Docker Compose"
    
    if command -v docker-compose &> /dev/null; then
        print_success "Docker Compose already installed"
        docker-compose --version
    else
        print_info "Installing Docker Compose..."
        curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        chmod +x /usr/local/bin/docker-compose
        
        print_success "Docker Compose installed successfully"
    fi
}

# Setup environment
setup_environment() {
    print_header "Setting up Environment"
    
    if [ ! -f .env ]; then
        print_info "Creating .env file from template..."
        cp .env.example .env
        
        print_warning "IMPORTANT: Please edit .env file and update all passwords and secrets!"
        print_info "Required changes:"
        echo "  - All passwords (POSTGRES, REDIS, MINIO, etc.)"
        echo "  - JWT secrets (use: openssl rand -base64 32)"
        echo "  - Domain name"
        echo "  - Email configuration"
        echo "  - Payment gateway keys"
        
        read -p "Press Enter when you've updated .env file..."
    else
        print_success ".env file already exists"
    fi
}

# Generate SSL certificates
setup_ssl() {
    print_header "Setting up SSL Certificates"
    
    read -p "Do you want to generate SSL certificates with Let's Encrypt? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        source .env
        
        print_info "Generating SSL certificates for $DOMAIN..."
        
        # Create required directories
        mkdir -p certbot/conf certbot/www
        
        # Get certificate
        docker-compose run --rm certbot certonly --webroot \
            --webroot-path=/var/www/certbot \
            --email $EMAIL \
            --agree-tos \
            --no-eff-email \
            -d $DOMAIN \
            -d www.$DOMAIN \
            -d api.$DOMAIN \
            -d evolution.$DOMAIN
        
        print_success "SSL certificates generated"
    else
        print_warning "Skipping SSL certificate generation"
        print_info "You can generate them later with: ./scripts/generate-ssl.sh"
    fi
}

# Initialize database
init_database() {
    print_header "Initializing Database"
    
    print_info "Starting PostgreSQL..."
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    print_info "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    print_info "Running database migrations..."
    docker-compose exec -T api npx prisma migrate deploy
    
    print_success "Database initialized"
}

# Create admin user
create_admin() {
    print_header "Creating Admin User"
    
    read -p "Do you want to create an admin user? (y/n): " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        read -p "Admin email: " ADMIN_EMAIL
        read -sp "Admin password: " ADMIN_PASSWORD
        echo
        
        docker-compose exec -T api node scripts/create-admin.js \
            --email "$ADMIN_EMAIL" \
            --password "$ADMIN_PASSWORD"
        
        print_success "Admin user created"
    fi
}

# Setup monitoring
setup_monitoring() {
    print_header "Setting up Monitoring"
    
    # Create Prometheus config
    mkdir -p prometheus
    cat > prometheus/prometheus.yml << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'api'
    static_configs:
      - targets: ['api:8000']
    metrics_path: '/api/v1/metrics'

  - job_name: 'evolution-api'
    static_configs:
      - targets: ['evolution-api:8080']

  - job_name: 'node-exporter'
    static_configs:
      - targets: ['node-exporter:9100']
EOF

    # Create Grafana provisioning
    mkdir -p grafana/provisioning/datasources
    cat > grafana/provisioning/datasources/datasources.yml << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true

  - name: InfluxDB
    type: influxdb
    access: proxy
    url: http://influxdb:8086
    jsonData:
      version: Flux
      organization: wagateway
      defaultBucket: pon_monitoring
    secureJsonData:
      token: ${INFLUXDB_TOKEN}
    editable: true
EOF

    print_success "Monitoring configured"
}

# Start services
start_services() {
    print_header "Starting Services"
    
    print_info "Pulling latest images..."
    docker-compose pull
    
    print_info "Building custom images..."
    docker-compose build
    
    print_info "Starting all services..."
    docker-compose up -d
    
    print_success "All services started"
}

# Health check
health_check() {
    print_header "Health Check"
    
    print_info "Waiting for services to be healthy..."
    sleep 30
    
    # Check each service
    services=("postgres" "redis" "api" "evolution-api" "frontend" "nginx")
    
    for service in "${services[@]}"; do
        if docker-compose ps | grep -q "$service.*Up"; then
            print_success "$service is running"
        else
            print_error "$service is not running"
        fi
    done
}

# Display access info
display_info() {
    print_header "Deployment Complete!"
    
    source .env
    
    echo ""
    print_success "Application URLs:"
    echo "  • Frontend:     https://$DOMAIN"
    echo "  • API:          https://api.$DOMAIN"
    echo "  • Evolution:    https://evolution.$DOMAIN"
    echo "  • Grafana:      http://$DOMAIN:3001"
    echo ""
    print_info "Default Credentials:"
    echo "  • Grafana:      $GRAFANA_USER / $GRAFANA_PASSWORD"
    echo ""
    print_warning "Important Next Steps:"
    echo "  1. Change all default passwords"
    echo "  2. Configure your domain DNS"
    echo "  3. Update payment gateway credentials"
    echo "  4. Test all functionalities"
    echo "  5. Setup backup cron job"
    echo ""
    print_info "Useful Commands:"
    echo "  • View logs:    docker-compose logs -f [service]"
    echo "  • Restart:      docker-compose restart [service]"
    echo "  • Stop:         docker-compose down"
    echo "  • Backup DB:    ./scripts/backup-database.sh"
    echo ""
}

# Main deployment flow
main() {
    print_header "WhatsApp Gateway SaaS - Deployment"
    
    # Check root
    check_root
    
    # Install dependencies
    install_docker
    install_docker_compose
    
    # Setup
    setup_environment
    setup_monitoring
    setup_ssl
    
    # Deploy
    start_services
    init_database
    create_admin
    
    # Verify
    health_check
    display_info
    
    print_success "Deployment completed successfully!"
}

# Run main function
main
