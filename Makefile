.PHONY: help
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36mmake %-10s\033[0m %s\n", $$1, $$2}'

.PHONY: install
install: ## Install dependencies
	npm install

.PHONY: build
build: ## Build the project
	npm run build

.PHONY: start
start: ## Start the MCP server
	npm start

.PHONY: dev
dev: ## Start the MCP server in development mode
	npm run dev

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	rm -rf build node_modules
