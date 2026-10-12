.PHONY: help install dev up down logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Sync Python dependencies with uv
	uv sync

dev: ## Run the API locally with hot reload (fastapi dev)
	uv run fastapi dev

up: ## Build and start the API container (detached)
	docker compose build --no-cache && docker compose up --force-recreate

down: ## Stop the API container
	docker compose down --rmi local --volumes

logs: ## Follow container logs
	docker compose logs -f

seed: ## Seed a demo user (EMAIL/PASSWORD env vars override defaults)
	uv run python -m scripts.seed