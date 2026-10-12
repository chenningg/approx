.PHONY: dev up down logs api-dev frontend-dev api-up frontend-up

dev: ## Run both containers via docker compose (foreground, hot reload)
	docker compose build --no-cache && docker compose up --force-recreate

up: ## Build (no cache) and start all containers
	docker compose build --no-cache && docker compose up --force-recreate

down: ## Stop containers, remove built images and volumes
	docker compose down --rmi local --volumes

logs: ## Follow logs from all containers
	docker compose logs -f