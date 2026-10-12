.PHONY: help install dev build lint up down logs

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-16s\033[0m %s\n", $$1, $$2}'

install: ## Install npm dependencies
	npm install

dev: ## Run the Vite dev server with HMR
	npm run dev

build: ## Typecheck and build for production
	npm run build

lint: ## Lint with oxlint
	npm run lint

up: ## Build and start the frontend container
	docker compose up --build -d

down: ## Stop the frontend container
	docker compose down --remove-orphans

logs: ## Follow container logs
	docker compose logs -f