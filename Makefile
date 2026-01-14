# Makefile for WhatsApp Gateway SaaS

.PHONY: help install dev build start stop restart logs clean backup restore

# Default target
.DEFAULT_GOAL := help

# Colors
BLUE := \033[0;34m
GREEN := \033[0;32m
YELLOW := \033[1;33m
NC := \033[0m # No Color

help: ## Show this help message
	@echo "$(BLUE)WhatsApp Gateway SaaS - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'

install: ## Install dependencies
	@echo "$(BLUE)Installing dependencies...$(NC)"
	cd backend && npm install
	cd frontend && npm install
	cd poller && pip install -r requirements.txt
	@echo "$(GREEN)✓ Dependencies installed$(NC)"

dev: ## Run in development mode
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker-compose -f docker-compose.dev.yml up -d
	@echo "$(GREEN)✓ Development environment started$(NC)"
	@echo "Frontend: http://localhost:3000"
	@echo "API: http://localhost:8000"
	@echo "Evolution API: http://localhost:8080"

build: ## Build Docker images
	@echo "$(BLUE)Building Docker images...$(NC)"
	docker-compose build
	@echo "$(GREEN)✓ Build complete$(NC)"

start: ## Start production environment
	@echo "$(BLUE)Starting production environment...$(NC)"
	docker-compose up -d
	@echo "$(GREEN)✓ Production environment started$(NC)"

stop: ## Stop all services
	@echo "$(YELLOW)Stopping all services...$(NC)"
	docker-compose down
	@echo "$(GREEN)✓ All services stopped$(NC)"

restart: ## Restart all services
	@echo "$(BLUE)Restarting all services...$(NC)"
	docker-compose restart
	@echo "$(GREEN)✓ All services restarted$(NC)"

logs: ## View logs (use service=<name> for specific service)
	@if [ -z "$(service)" ]; then \
		docker-compose logs -f --tail=100; \
	else \
		docker-compose logs -f --tail=100 $(service); \
	fi

ps: ## Show running containers
	@docker-compose ps

clean: ## Clean up containers and volumes
	@echo "$(YELLOW)Cleaning up...$(NC)"
	docker-compose down -v
	docker system prune -f
	@echo "$(GREEN)✓ Cleanup complete$(NC)"

backup: ## Backup database
	@echo "$(BLUE)Creating backup...$(NC)"
	./scripts/backup-database.sh
	@echo "$(GREEN)✓ Backup complete$(NC)"

restore: ## Restore from backup (use file=<path>)
	@if [ -z "$(file)" ]; then \
		echo "$(YELLOW)Usage: make restore file=/path/to/backup.tar.gz$(NC)"; \
	else \
		echo "$(BLUE)Restoring from backup...$(NC)"; \
		./scripts/restore-backup.sh $(file); \
		echo "$(GREEN)✓ Restore complete$(NC)"; \
	fi

migrate: ## Run database migrations
	@echo "$(BLUE)Running migrations...$(NC)"
	docker-compose exec api npx prisma migrate deploy
	@echo "$(GREEN)✓ Migrations complete$(NC)"

migrate-dev: ## Create new migration
	@echo "$(BLUE)Creating migration...$(NC)"
	cd backend && npx prisma migrate dev
	@echo "$(GREEN)✓ Migration created$(NC)"

seed: ## Seed database
	@echo "$(BLUE)Seeding database...$(NC)"
	docker-compose exec api npm run seed
	@echo "$(GREEN)✓ Database seeded$(NC)"

generate: ## Generate Prisma client
	@echo "$(BLUE)Generating Prisma client...$(NC)"
	cd backend && npx prisma generate
	@echo "$(GREEN)✓ Prisma client generated$(NC)"

studio: ## Open Prisma Studio
	@echo "$(BLUE)Opening Prisma Studio...$(NC)"
	cd backend && npx prisma studio

test: ## Run tests
	@echo "$(BLUE)Running tests...$(NC)"
	cd backend && npm test
	@echo "$(GREEN)✓ Tests complete$(NC)"

lint: ## Run linter
	@echo "$(BLUE)Running linter...$(NC)"
	cd backend && npm run lint
	cd frontend && npm run lint
	@echo "$(GREEN)✓ Linting complete$(NC)"

deploy: ## Deploy to production
	@echo "$(BLUE)Deploying to production...$(NC)"
	./deploy.sh
	@echo "$(GREEN)✓ Deployment complete$(NC)"

health: ## Check health of all services
	@echo "$(BLUE)Checking service health...$(NC)"
	@./scripts/health-check.sh

ssl: ## Generate SSL certificates
	@echo "$(BLUE)Generating SSL certificates...$(NC)"
	./scripts/generate-ssl.sh
	@echo "$(GREEN)✓ SSL certificates generated$(NC)"

update: ## Update application
	@echo "$(BLUE)Updating application...$(NC)"
	git pull origin main
	make build
	make migrate
	make restart
	@echo "$(GREEN)✓ Update complete$(NC)"

stats: ## Show Docker stats
	@docker stats --no-stream

shell-api: ## Open shell in API container
	@docker-compose exec api sh

shell-db: ## Open PostgreSQL shell
	@docker-compose exec postgres psql -U $(POSTGRES_USER) $(POSTGRES_DB)

shell-redis: ## Open Redis CLI
	@docker-compose exec redis redis-cli

code-gen: ## Generate boilerplate code
	@echo "$(BLUE)Generating boilerplate code...$(NC)"
	chmod +x scripts/generate-code.sh
	./scripts/generate-code.sh
	@echo "$(GREEN)✓ Code generation complete$(NC)"
