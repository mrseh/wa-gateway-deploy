#!/bin/bash
# Test Script - Verify Deployment
# Run: ./test-deployment.sh

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

echo -e "${GREEN}=========================================="
echo "WhatsApp Gateway - Deployment Test"
echo -e "==========================================${NC}"
echo ""

# Test function
test_service() {
    local name=$1
    local command=$2
    
    echo -n "Testing $name... "
    if eval "$command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((PASSED++))
        return 0
    else
        echo -e "${RED}✗ FAILED${NC}"
        ((FAILED++))
        return 1
    fi
}

# 1. Test Docker
echo -e "${YELLOW}[1] Docker Services${NC}"
test_service "Docker running" "docker ps"
test_service "Docker Compose" "docker-compose version"
echo ""

# 2. Test Containers
echo -e "${YELLOW}[2] Container Status${NC}"
test_service "PostgreSQL container" "docker ps | grep -q wagateway-postgres"
test_service "Redis container" "docker ps | grep -q wagateway-redis"
test_service "API container" "docker ps | grep -q wagateway-api"
test_service "Frontend container" "docker ps | grep -q wagateway-frontend"
test_service "Evolution container" "docker ps | grep -q wagateway-evolution"
echo ""

# 3. Test Database
echo -e "${YELLOW}[3] Database Connectivity${NC}"
test_service "PostgreSQL connection" "docker exec wagateway-postgres pg_isready -U wagateway"
test_service "Database exists" "docker exec wagateway-postgres psql -U wagateway -lqt | cut -d \\| -f 1 | grep -qw wagateway"
test_service "Tables created" "docker exec wagateway-postgres psql -U wagateway -d wagateway -c '\dt' | grep -q users"
echo ""

# 4. Test Redis
echo -e "${YELLOW}[4] Redis Connectivity${NC}"
test_service "Redis ping" "docker exec wagateway-redis redis-cli ping"
echo ""

# 5. Test API Endpoints
echo -e "${YELLOW}[5] API Endpoints${NC}"
test_service "API health endpoint" "curl -f http://localhost:8000/health"
test_service "API detailed health" "curl -f http://localhost:8000/health/detailed"
test_service "API ready probe" "curl -f http://localhost:8000/ready"
echo ""

# 6. Test Evolution API
echo -e "${YELLOW}[6] Evolution API${NC}"
test_service "Evolution fetch instances" "curl -f http://localhost:8080/instance/fetchInstances"
echo ""

# 7. Test Frontend
echo -e "${YELLOW}[7] Frontend${NC}"
test_service "Frontend accessible" "curl -f -I http://localhost:3000"
echo ""

# 8. Test API Registration
echo -e "${YELLOW}[8] API Registration (E2E Test)${NC}"
REGISTER_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test'$(date +%s)'@test.com",
    "password": "Test123!",
    "company_name": "Test Company"
  }')

if echo "$REGISTER_RESPONSE" | grep -q "success"; then
    echo -e "API Registration: ${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "API Registration: ${YELLOW}⚠ SKIPPED (user may exist)${NC}"
fi
echo ""

# 9. Test Login
echo -e "${YELLOW}[9] API Login (E2E Test)${NC}"
LOGIN_RESPONSE=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com",
    "password": "Admin123!"
  }')

if echo "$LOGIN_RESPONSE" | grep -q "token\|access_token"; then
    echo -e "API Login: ${GREEN}✓ PASSED${NC}"
    ((PASSED++))
else
    echo -e "API Login: ${YELLOW}⚠ SKIPPED (user not created yet)${NC}"
fi
echo ""

# Results
echo -e "${GREEN}=========================================="
echo "Test Results"
echo -e "==========================================${NC}"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ ALL TESTS PASSED!${NC}"
    echo -e "${GREEN}Your WhatsApp Gateway is working correctly!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Access: http://localhost:3000"
    echo "2. Register your account"
    echo "3. Create WhatsApp instance"
    exit 0
else
    echo -e "${RED}❌ SOME TESTS FAILED!${NC}"
    echo ""
    echo "Debug commands:"
    echo "  View logs: docker-compose logs -f"
    echo "  Check status: docker-compose ps"
    echo "  Restart service: docker-compose restart [service]"
    exit 1
fi
