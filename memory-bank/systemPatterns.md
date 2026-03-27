# System patterns

## Routing groups (Next.js App Router)

Under `app/src/app/`:

- `(auth)` — authentication flows/layout.
- `(dashboard)` — logged-in product shell.
- `admin` — moderation / admin layout.

Adjust this list if routes move.

## API routes

REST-style handlers under `app/src/app/api/` (e.g. districts search/list). Prefer consistent validation (Zod), auth checks, and rate limiting where public.

## Libraries (`app/src/lib/`)

Shared utilities include auth, logging, rate limiting, sanitization — reuse instead of duplicating. **Extend existing patterns** when adding features.

## Data

- Prisma schema: `app/prisma/schema.prisma`.
- Use migrations and scripts (`db:ensure`, `seed`) for local and deployed environments.

## Conventions

- TypeScript with strict settings (project expectation).
- Prefer `??` over `||` for nullish defaults unless falsy coercion is intentional.
- Avoid non-null assertions (`!`) unless truly justified.

## Security / hygiene

- Sanitize user-controlled HTML/text where rendered (e.g. DOMPurify usage in stack).
- Rate limit sensitive public endpoints.
