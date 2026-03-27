# Tech context

## Monorepo layout

- **Application:** `app/` — Next.js App Router project (primary codebase).
- **Product spec:** `docs/PRD.md`.
- **Memory bank:** `memory-bank/` (this folder).

## Stack (`app/package.json`)

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16.x (App Router) |
| UI | React 19, Tailwind CSS 4, Base UI, shadcn tooling, lucide |
| Auth | NextAuth v5 beta, `@auth/prisma-adapter` |
| DB | PostgreSQL via `pg`, Prisma 7 (`@prisma/adapter-pg`) |
| Validation | Zod 4 |
| Email | Resend, React Email |
| Logging | pino |
| Test | Vitest, Playwright (e2e) |

## Common commands (from `app/`)

```bash
npm run dev          # Next dev server
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest
npm run test:e2e     # Playwright
npm run db:ensure    # Database ensure script
npm run seed         # Seed script
```

## Environment

- Use `.env` / `.env.local` as required by Next.js, Prisma, NextAuth, and Resend. Do not commit secrets.

## PRD technical appendix

PRD lists stack as “TBD by developer”; this file reflects the **implemented** choices above.
