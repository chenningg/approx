.PHONY: help install dev up down logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Sync Python dependencies with uv
	uv sync

dev: ## Run the API locally with hot reload (fastapi dev)
	uv run fastapi dev

up: ## Build and start the API container (detached)
	docker compose up -d --build

down: ## Stop the API container
	docker compose down

logs: ## Follow container logs
	docker compose logs -f