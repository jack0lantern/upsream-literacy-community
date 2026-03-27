.DEFAULT_GOAL := help

.PHONY: help setup run dev test test-e2e seed db-ensure db-reset db-migrate db-studio lint clean

help:
	@echo "Upstream Literacy — app"
	@echo ""
	@echo "  make setup      First-time setup (deps, .env.local, Postgres DB, migrate, seed, Playwright)"
	@echo "  make db-ensure  Create DATABASE_URL database if missing (before migrate/seed)"
	@echo "  make run        Start the dev server (same as: make dev)"
	@echo "  make test       Run unit/integration tests (vitest)"
	@echo "  make test-e2e   Run Playwright e2e tests (dev server must be running)"
	@echo ""

# One-command setup: install deps, set up DB, seed data
setup:
	@echo "Installing dependencies..."
	pnpm install
	@echo "Setting up environment..."
	cp -n .env.example .env.local || true
	@# Generate a real AUTH_SECRET if it still has the placeholder value
	@if grep -q 'AUTH_SECRET="generate-with-openssl-rand-base64-32"' .env.local 2>/dev/null; then \
		SECRET=$$(openssl rand -base64 32); \
		sed -i '' "s|AUTH_SECRET=\"generate-with-openssl-rand-base64-32\"|AUTH_SECRET=\"$$SECRET\"|" .env.local; \
		echo "  Generated AUTH_SECRET"; \
	fi
	@echo "Ensuring database exists..."
	pnpm run db:ensure
	@echo "Running migrations..."
	pnpm prisma migrate dev --name init
	@echo "Seeding data..."
	pnpm run seed
	@echo "Installing Playwright browsers..."
	npx playwright install chromium
	@echo "Setup complete! Run 'make run' to start."

# Start dev server (one command)
run: dev

dev:
	@# Kill any existing Next.js dev server for this directory before starting
	@PID=$$(lsof -ti :3000 -sTCP:LISTEN 2>/dev/null); \
	if [ -n "$$PID" ]; then \
		echo "Stopping existing dev server (PID $$PID) on port 3000..."; \
		kill $$PID 2>/dev/null; \
		sleep 1; \
	fi
	pnpm dev

# Run unit/integration tests
test:
	pnpm test

# Run Playwright e2e tests (dev server must be running)
test-e2e:
	pnpm test:e2e

# Create application database if it does not exist (connects via .../postgres)
db-ensure:
	pnpm run db:ensure

# Seed database (NCES districts + problem statements)
seed:
	pnpm run seed

# Reset database (drop, recreate, migrate, seed)
db-reset:
	pnpm prisma migrate reset --force
	pnpm run seed

# Run new migration
db-migrate:
	pnpm prisma migrate dev

# Open Prisma Studio
db-studio:
	pnpm prisma studio

# Lint + format check
lint:
	pnpm lint && pnpm prettier --check .

# Clean build artifacts
clean:
	rm -rf .next node_modules
