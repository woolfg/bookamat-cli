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

.PHONY: link
link: build ## Build and link 'bookamat' globally (run once after checkout)
	npm link

.PHONY: unlink
unlink: ## Remove the global 'bookamat' symlink
	npm unlink -g bookamat-cli

.PHONY: dev
dev: ## Run CLI without building via tsx, e.g. make dev ARGS="bookings list"
	npx tsx src/index.ts $(ARGS)

.PHONY: clean
clean: ## Remove build artifacts and node_modules
	rm -rf build node_modules
