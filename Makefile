.PHONY: help start stop restart logs health backup

help:
	@echo "WhatsApp Gateway SaaS - Commands"
	@echo "================================"
	@echo "make start     - Start all services"
	@echo "make stop      - Stop all services"
	@echo "make restart   - Restart all services"
	@echo "make logs      - View logs"
	@echo "make health    - Check health"
	@echo "make backup    - Create backup"

start:
	docker-compose up -d

stop:
	docker-compose down

restart:
	docker-compose restart

logs:
	docker-compose logs -f --tail=100

health:
	./scripts/health-check.sh

backup:
	./scripts/backup.sh
