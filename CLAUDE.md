# Upstream Literacy Community

Peer-matching platform connecting district literacy leaders with counterparts in demographically similar districts tackling the same challenges. Built on NCES district data with rules-based weighted matching.

## Project Structure

This is a monorepo with the app living in `app/`. All commands should be run from the `app/` directory.

```
app/                    # Next.js 16 application (the main codebase)
  src/
    app/                # Next.js App Router pages and API routes
      (auth)/           # Auth pages: login, signup, forgot/reset password
      (dashboard)/      # Dashboard, messages, onboarding, profile
      admin/            # Admin panel: flagged content, keywords, problems, users
      api/              # API routes (auth, admin, conversations, matches, etc.)
    components/         # React components (shared UI + feature components)
      ui/               # shadcn/ui primitives
    lib/                # Shared utilities (auth, db, email, logger, analytics, etc.)
    __tests__/          # Vitest unit/integration tests
  e2e/                  # Playwright end-to-end tests
  prisma/               # Prisma schema + migrations
  scripts/              # DB setup & seed scripts
  docs/                 # PRD, implementation plan, seed account docs
```

## Tech Stack

- **Framework:** Next.js 16 (App Router) with React 19
- **Language:** TypeScript
- **Database:** PostgreSQL via Prisma ORM (v7)
- **Auth:** NextAuth v5 (beta) with credentials provider
- **Styling:** Tailwind CSS v4 + shadcn/ui components
- **Email:** Resend + React Email
- **Package Manager:** pnpm
- **Testing:** Vitest (unit/integration), Playwright (e2e)
- **Logging:** Pino

## Common Commands

All commands run from the `app/` directory:

```bash
make setup          # First-time setup (deps, env, DB, migrations, seed, Playwright)
make run            # Start dev server (port 3000)
make test           # Run vitest unit/integration tests
make test-e2e       # Run Playwright e2e tests (dev server must be running)
make lint           # ESLint + Prettier check
make seed           # Seed database with NCES districts + problem statements
make db-migrate     # Run Prisma migrations
make db-reset       # Drop, recreate, migrate, seed
make db-studio      # Open Prisma Studio
```

## Environment

- Copy `.env.example` to `.env.local` for local development
- Requires PostgreSQL running locally (default: `upstream_literacy_dev`)
- `make setup` handles everything for first-time setup

## Key Concepts

- **Districts** are imported from NCES data (~18K records) with demographic info (urbanicity, enrollment, FRL%, ELL%)
- **Matching** uses rules-based weighted scoring: problem overlap (40%), district size (20%), urbanicity (20%), FRL% (10%), ELL% (10%)
- **Problem Statements** are a curated taxonomy of 20 literacy challenges across 7 categories
- Matches below score 30 are not shown
- Users select 1-5 problem statements during onboarding

## Guidelines

- Follow the existing AGENTS.md in `app/` — Next.js 16 has breaking changes from earlier versions. Read `node_modules/next/dist/docs/` before writing Next.js code.
- Use Prisma's `@map()` convention for snake_case DB columns with camelCase TypeScript fields
- Keep API routes in `src/app/api/` following Next.js App Router conventions
- Use shadcn/ui components from `src/components/ui/` for UI primitives
- Sanitize user input with the `src/lib/sanitize.ts` utility
- Use `src/lib/logger.ts` (Pino) for logging, not console.log
