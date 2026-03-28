# Upstream Literacy Community

Peer-matching platform for district literacy leaders. It connects leaders with counterparts in demographically similar districts who share the same literacy challenges, using NCES district data and a curated taxonomy of problem statements.

## Repository layout

| Path | Purpose |
|------|---------|
| `app/` | Next.js 16 application (run all dev commands from here) |
| `docs/` | Product requirements, implementation plan, and project notes |
| `memory-bank/` | Working notes for contributors (optional context) |

## Quick start

Prerequisites: **Node.js**, **pnpm**, and **PostgreSQL** running locally.

```bash
cd app
make setup    # installs deps, .env.local, DB, migrations, seed, Playwright
make run      # dev server at http://localhost:3000
```

Other useful commands (from `app/`):

```bash
make help       # list Makefile targets
make test       # Vitest unit/integration tests
make test-e2e   # Playwright (start dev server first)
make lint       # ESLint + Prettier check
```

Copy environment defaults from `app/.env.example` to `app/.env.local` if you set up manually; `make setup` does this for you.

## Tech stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript  
- **Database:** PostgreSQL with Prisma  
- **Auth:** NextAuth v5 (credentials)  
- **UI:** Tailwind CSS v4, shadcn/ui  
- **Email:** Resend + React Email  
- **Tests:** Vitest, Playwright  

## Documentation

- [Product requirements](docs/PRD.md)  
- [Implementation plan](docs/implementation-plan.md)  
- [Problem / scope summary](docs/upstream-literacy-community.md)  

Agent and contributor conventions for the Next.js app live in `app/AGENTS.md` and the repo-level `CLAUDE.md`.

## Matching (high level)

Matching uses weighted, rules-based scoring over problem overlap and district attributes (size, urbanicity, FRL%, ELL%). Scores below the configured threshold are not shown to users. Details are in the PRD and implementation plan.
