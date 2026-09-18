.PHONY: help install dev up down logs api-dev frontend-dev api-up frontend-up

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies for both subprojects
	$(MAKE) -C api install
	$(MAKE) -C frontend install

dev: ## Run both containers via docker compose (foreground, hot reload)
	docker compose up --build

up: ## Build and start all containers (detached)
	docker compose up -d --build

down: ## Stop all containers
	docker compose down

logs: ## Follow logs from all containers
	docker compose logs -f

api-dev: ## Run the API locally with hot reload
	$(MAKE) -C api dev

frontend-dev: ## Run the frontend locally with HMR
	$(MAKE) -C frontend dev

api-up: ## Start only the API container
	docker compose up -d --build api

frontend-up: ## Start only the frontend container
	docker compose up -d --build frontend