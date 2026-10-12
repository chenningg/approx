.PHONY: dev up down logs api-dev frontend-dev api-up frontend-up

dev: ## Run both containers via docker compose (foreground, hot reload)
	docker compose up --build -d

up: ## Build and start all containers
	docker compose up --build -d

down: ## Stop containers, remove built images and volumes
	docker compose down --remove-orphans

logs: ## Follow logs from all containers
	docker compose logs -f