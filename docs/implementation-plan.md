# Implementation Plan: Upstream Literacy Community

**Version:** 1.0
**Date:** 2026-03-26
**Status:** Final (post-critic-loop)

---

## 1. Architecture Summary

| Decision | Choice |
|----------|--------|
| **Framework** | Next.js 14+ (App Router, full-stack) |
| **Database** | PostgreSQL |
| **ORM** | Prisma |
| **Auth** | NextAuth.js (Auth.js) — Credentials provider |
| **Hosting** | Railway (app + managed Postgres) |
| **Messaging** | HTTP polling (5s interval) |
| **Email** | Resend + React Email templates |
| **UI** | Tailwind CSS + shadcn/ui |
| **Deployment** | Railway push-to-deploy from GitHub |

### Resolved Ambiguities

| Ambiguity | Resolution |
|-----------|------------|
| Email verification | Non-blocking. User can access platform immediately; banner reminds them to verify. |
| District not in NCES | Allow manual entry (name, state, enrollment, etc.). Flagged `is_manual = true` for admin review. |
| Proximity sort | Dropped from MVP. Sort options: match score, recently active. |
| Read receipts | WhatsApp-style. Sender sees "Read" timestamp under delivered messages. |
| Email batching | 15-min suppression window per recipient. First message triggers immediate email; subsequent messages within 15 min are batched into a digest. |
| Conversation muting | `ConversationMember` join table with per-user `muted` and `last_read_at`. `Conversation.status` reserved for admin-level states (active, closed, flagged). |

### Revised Data Model

```
District
├── id (PK)
├── nces_id (unique, nullable for manual entries)
├── name
├── state
├── locale_code
├── urbanicity (enum: urban, suburban, town, rural)
├── total_enrollment
├── size_bucket (enum: small, medium, large, very_large)
├── frl_pct (float)
├── ell_pct (float)
├── is_manual (bool, default false)
├── updated_at

User
├── id (PK)
├── email (unique)
├── password_hash
├── name
├── role (enum)
├── bio (varchar 280)
├── district_id (FK → District)
├── is_admin (bool, default false)
├── email_verified (bool, default false)
├── status (enum: active, suspended, deactivated)
├── created_at
├── last_active_at

ProblemStatement
├── id (PK)
├── label
├── category
├── sort_order
├── active (bool)
├── created_at

UserProblem (M2M join)
├── user_id (FK → User)
├── problem_id (FK → ProblemStatement)
├── selected_at

Conversation
├── id (PK)
├── created_at
├── status (enum: active, closed, flagged)

ConversationMember (join table)
├── id (PK)
├── conversation_id (FK → Conversation)
├── user_id (FK → User)
├── muted (bool, default false)
├── last_read_at (timestamp)
├── joined_at

Message
├── id (PK)
├── conversation_id (FK → Conversation)
├── sender_id (FK → User)
├── body (text)
├── sent_at
├── read_at
├── flagged (bool, default false)
├── deleted_at (nullable, soft delete)

AnalyticsEvent
├── id (PK)
├── user_id (FK → User, nullable)
├── event_type (string)
├── properties (jsonb)
├── created_at
```

---

## 2. Phase-by-Phase Implementation Plan

### Phase 0: Project Bootstrap

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| P0.1 | Initialize Next.js 14 project with App Router, TypeScript | None | Auth & User |
| P0.2 | Configure Tailwind CSS + install shadcn/ui components | P0.1 | Auth & User |
| P0.3 | Set up Prisma, define initial schema, connect to local Postgres | P0.1 | Data & Matching |
| P0.4 | Create Railway project (web service + Postgres addon) | None | Auth & User |
| P0.5 | Set up Resend account, get API key | None | Messaging |
| P0.6 | Configure `.env.local` with all secrets, document in `.env.example` | P0.3, P0.4, P0.5 | Auth & User |
| P0.7 | Create `Makefile` with setup/dev/test/seed commands | P0.1 | Auth & User |
| P0.8 | Set up ESLint + Prettier config | P0.1 | Auth & User |
| P0.9 | Set up structured logging (pino) + request ID middleware | P0.1 | Messaging |

**Parallelization:** P0.4, P0.5 run in parallel with P0.1-P0.3. P0.8, P0.9 run after P0.1.

---

### Phase 1: Foundations

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| P1.1 | Define full Prisma schema (all entities from data model above) | P0.3 | Data & Matching |
| P1.2 | Write NCES data import script (download CCD flat file → parse CSV → insert ~18K districts) | P1.1 | Data & Matching |
| P1.3 | Seed problem statement taxonomy (20 items, 7 categories) | P1.1 | Data & Matching |
| P1.4 | Set up NextAuth.js with Credentials provider (email/password, bcrypt hashing) | P0.6 | Auth & User |
| P1.5 | Build email verification flow (send verification link via Resend, non-blocking access with banner) | P1.4, P0.5 | Auth & User |
| P1.6 | Build base layout shell (header, nav, responsive sidebar, auth-gated routes) | P0.2, P1.4 | Auth & User |
| P1.7 | Create React Email templates (verification, password reset, message notification) | P0.5 | Messaging |
| P1.8 | Build password reset flow (request → email link → reset form) | P1.4, P1.7 | Auth & User |
| P1.9 | Add rate limiting middleware (login: 5/min, signup: 3/min, messaging: 30/min) | P0.1 | Auth & User |
| P1.10 | Add health check endpoint (`/api/health`) | P0.1 | Auth & User |

**Parallelization:**
- Stream A (Data): P1.1 → P1.2 + P1.3 (parallel)
- Stream B (Auth): P1.4 → P1.5, P1.8 (parallel after P1.4)
- Stream C (UI): P1.6 (parallel with everything after P0.2)
- Stream D (Email): P1.7 (parallel, feeds into P1.5 and P1.8)
- P1.9, P1.10: independent, run anytime after P0.1

**Sync Point 1:** All Phase 1 tasks complete. Schema migrated, NCES data loaded, auth working, layout rendered.

---

### Phase 2: Core Systems

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| P2.1 | District search API (`/api/districts/search?q=`) — typeahead against NCES data, returns top 10 matches | P1.2 | Data & Matching |
| P2.2 | Onboarding flow UI — multi-step form: state → district search → confirm auto-filled fields → role → problems → bio | P2.1, P1.6 | Auth & User |
| P2.3 | Manual district entry form (shown when "My district isn't listed" is clicked) — creates district with `is_manual = true` | P2.2 | Auth & User |
| P2.4 | Profile view/edit page (update problem statements, bio; district is read-only after onboarding) | P2.2 | Auth & User |
| P2.5 | Matching engine — raw SQL query implementing weighted scoring (problem overlap 40%, size 20%, urbanicity 20%, FRL 10%, ELL 10%), returns scored + ranked results | P1.1, P1.2, P1.3 | Data & Matching |
| P2.6 | Match API endpoint (`/api/matches`) — pagination, filters (district type, size range, problem statements, state), sort (score, recently active), minimum threshold ≥30 | P2.5 | Data & Matching |
| P2.7 | Match discovery dashboard UI — match cards showing name, role, district stats, shared problems (highlighted), match score; filter sidebar; sort dropdown | P2.6, P1.6 | Data & Matching |
| P2.8 | Public user profile page (`/profile/[id]`) — full profile view with "Send Message" CTA | P2.4 | Auth & User |
| P2.9 | Account deactivation flow (user-initiated, sets status to deactivated, logged out) | P2.4 | Auth & User |

**Parallelization:**
- Stream A (Profile): P2.1 → P2.2 → P2.3, P2.4, P2.9 (parallel after P2.2)
- Stream B (Matching): P2.5 → P2.6 → P2.7
- P2.8: after P2.4
- Streams A and B run **fully in parallel**

**Sync Point 2:** User can sign up → build profile → see matches → view peer profiles. Core loop validated.

---

### Phase 3: Feature Implementation

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| **Messaging** | | | |
| P3.1 | Conversation creation API — creates Conversation + two ConversationMembers; prevents duplicate conversations between same users | Sync Point 2 | Messaging |
| P3.2 | Message sending API (`POST /api/messages`) — creates message, updates conversation `last_read_at` for sender; input sanitization (XSS prevention via DOMPurify server-side) | P3.1 | Messaging |
| P3.3 | Message polling API (`GET /api/conversations/[id]/messages?since=`) — returns new messages since timestamp, 5s poll interval on client | P3.2 | Messaging |
| P3.4 | Messaging UI — conversation list (sidebar), message thread view, input box, timestamps | P3.3 | Messaging |
| P3.5 | Read receipts — mark messages as read when thread is viewed; WhatsApp-style "Read [time]" under messages; update `ConversationMember.last_read_at` | P3.4 | Messaging |
| P3.6 | Conversation actions — mute (per-user via ConversationMember), report/flag (sets Conversation.status = flagged) | P3.4 | Messaging |
| P3.7 | Email notification system — on new message: check if recipient has been notified in last 15 min; if not, send immediately via Resend; if yes, queue digest. Simple in-memory debounce map per recipient (acceptable for MVP; lost on restart = extra email at worst) | P3.2, P1.7 | Messaging |
| **Admin** | | | |
| P3.8 | Admin dashboard layout — separate `/admin` route group, middleware checks `is_admin` | P1.6 | Admin |
| P3.9 | Admin user list — table with search, filter by status, sort by signup date; shows district, role, problem count | P3.8 | Admin |
| P3.10 | Admin flagged conversations view — list of flagged conversations with participants, flag reason, message preview | P3.8, P3.6 | Admin |
| P3.11 | Admin conversation viewer — read full message thread for flagged conversations; action buttons: warn user, suspend user, delete message (soft delete), close conversation | P3.10 | Admin |
| P3.12 | Admin platform stats — total users, active (7-day), messages sent (7-day), avg match score, flagged conversations count. Simple SQL aggregations displayed as stat cards. | P3.8 | Admin |
| P3.13 | Keyword alert system — configurable word list stored in DB; on message send, check body against list; auto-flag conversation if match | P3.2 | Admin |
| P3.14 | Admin problem statement CRUD — add, edit label/category, retire (set active=false). No deploy required. | P3.8 | Admin |
| **Analytics** | | | |
| P3.15 | Server-side event tracking — log key events to AnalyticsEvent table: signup, profile_complete, match_viewed, message_sent, conversation_started. Used for success metrics. | P1.1 | Data & Matching |

**Parallelization:**
- Stream A (Messaging): P3.1 → P3.2 → P3.3 → P3.4 → P3.5, P3.6 (parallel)
- Stream B (Notifications): P3.7 (after P3.2)
- Stream C (Admin): P3.8 → P3.9, P3.10, P3.12, P3.14 (parallel) → P3.11 (after P3.10)
- Stream D (Moderation): P3.13 (after P3.2)
- Stream E (Analytics): P3.15 (independent)
- Streams A/B and C/D run **fully in parallel**

**Sync Point 3:** Full feature set complete. All MVP functionality built.

---

### Phase 4: Integration

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| P4.1 | End-to-end flow test: signup → onboarding → see matches → send message → receive notification | Sync Point 3 | All |
| P4.2 | Admin moderation flow test: user flags conversation → admin sees it → admin warns/suspends → user state updates | Sync Point 3 | Admin QA |
| P4.3 | Email integration test: verification, password reset, message notification (batching behavior) | Sync Point 3 | Messaging QA |
| P4.4 | Edge case testing: manual district entry, suspended user can't message, deactivated user hidden from matches, empty match results, user with 0 problem statements can't proceed | Sync Point 3 | All QA |
| P4.5 | Responsive testing: Chrome, Firefox, Safari; mobile (375px), tablet (768px), desktop (1280px+) | P4.1 | Auth QA |
| P4.6 | Conversation access control: verify users can only read own conversations, admin can only read flagged ones | Sync Point 3 | Messaging QA |

---

### Phase 5: QA + Hardening

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| P5.1 | Security audit: auth bypass, XSS in message body, CSRF on state-changing endpoints, SQL injection via search, email enumeration (use generic errors), admin route protection | Phase 4 | Security Critic |
| P5.2 | Performance test: matching engine query time with 5K users and 20 problem statements; target <500ms p95 | Phase 4 | Implementation Critic |
| P5.3 | Rate limiting verification: confirm limits on login, signup, messaging endpoints | Phase 4 | Security Critic |
| P5.4 | Input validation pass: all forms (bio 280 char max, email format, password strength, problem statement 1-5 limit) | Phase 4 | All QA |
| P5.5 | Accessibility pass: keyboard navigation, ARIA labels, color contrast, screen reader testing | Phase 4 | Auth QA |
| P5.6 | Error handling: user-facing error messages for all API failures; 404/500 pages | Phase 4 | All |
| P5.7 | Loading states: skeleton loaders for match cards, conversation list; empty states for no matches, no messages | Phase 4 | Auth & User |
| P5.8 | Handle suspended user state in messaging: can't send, existing conversations show "account suspended" | Phase 4 | Messaging QA |

---

### Phase 6: Launch Readiness

| Task | Description | Dependencies | Agent |
|------|-------------|--------------|-------|
| P6.1 | Railway production environment setup (separate from staging) | Phase 5 | Auth & User |
| P6.2 | Environment variables + secrets in Railway dashboard | P6.1 | Auth & User |
| P6.3 | Run NCES data import on production database | P6.1 | Data & Matching |
| P6.4 | Seed problem statement taxonomy in production | P6.1 | Data & Matching |
| P6.5 | Create initial admin account(s) | P6.3 | Auth & User |
| P6.6 | Set up custom domain + SSL (Railway provides SSL) | P6.1 | Auth & User |
| P6.7 | Configure Resend production domain (DNS records for deliverability) | P6.1 | Messaging |
| P6.8 | Smoke test production: full signup → match → message flow | P6.3, P6.5 | All |
| P6.9 | Set up basic uptime monitoring (Railway metrics, or free UptimeRobot) | P6.1 | Admin |

---

## 3. Agent System Design

### Agent Roster

```
┌─────────────────────────────────────────────────────────────┐
│                    ORCHESTRATOR AGENT                        │
│  Controls execution order, manages sync points,             │
│  resolves cross-agent dependencies                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  IMPLEMENTATION AGENTS          PAIRED QA AGENTS            │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │ Auth & User Agent   │ ←──→ │ Auth QA Agent        │     │
│  │ - Auth/sessions     │       │ - Auth flow tests    │     │
│  │ - Profile system    │       │ - Profile validation  │     │
│  │ - Onboarding flow   │       │ - Access control     │     │
│  │ - Layout/shell      │       │ - Responsive tests   │     │
│  └─────────────────────┘       └─────────────────────┘     │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │ Data & Matching     │ ←──→ │ Data QA Agent        │     │
│  │ Agent               │       │ - Import validation  │     │
│  │ - NCES import       │       │ - Match score tests  │     │
│  │ - Matching engine   │       │ - Filter/sort tests  │     │
│  │ - Discovery UI      │       │ - Performance tests  │     │
│  │ - Analytics events  │       │                      │     │
│  └─────────────────────┘       └─────────────────────┘     │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │ Messaging Agent     │ ←──→ │ Messaging QA Agent   │     │
│  │ - Conversations     │       │ - Send/receive tests │     │
│  │ - Messages + poll   │       │ - Read receipt tests │     │
│  │ - Read receipts     │       │ - Notification tests │     │
│  │ - Email notifs      │       │ - Access control     │     │
│  └─────────────────────┘       └─────────────────────┘     │
│  ┌─────────────────────┐       ┌─────────────────────┐     │
│  │ Admin Agent         │ ←──→ │ Admin QA Agent       │     │
│  │ - Admin dashboard   │       │ - Admin route tests  │     │
│  │ - Moderation tools  │       │ - Action flow tests  │     │
│  │ - Stats             │       │ - Keyword tests      │     │
│  │ - Keyword alerts    │       │ - Stats accuracy     │     │
│  │ - Problem CRUD      │       │                      │     │
│  └─────────────────────┘       └─────────────────────┘     │
│                                                             │
│  CRITIC AGENTS                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Auditor Critic      │  │ Security Critic      │          │
│  │ - Requirement       │  │ - Auth bypass        │          │
│  │   coverage          │  │ - Input sanitization │          │
│  │ - Missing flows     │  │ - Access control     │          │
│  │ - Edge cases        │  │ - Rate limiting      │          │
│  └─────────────────────┘  └─────────────────────┘          │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ Implementation      │  │ Observability        │          │
│  │ Critic              │  │ Critic               │          │
│  │ - Feasibility       │  │ - Logging coverage   │          │
│  │ - Sequencing        │  │ - Metrics            │          │
│  │ - Complexity        │  │ - Health checks      │          │
│  │ - Performance       │  │ - Error tracking     │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Orchestrator Execution Rules

1. **Parallel by default:** If two tasks have no dependency, run them in parallel across agents.
2. **Sync points are hard gates:** No agent proceeds past a sync point until all tasks before it are complete.
3. **QA agents trail by one task:** Each QA agent validates the most recently completed task from its paired implementation agent before the next task starts.
4. **Critic agents run at phase boundaries:** After each phase completes, all 4 critics review before the next phase begins.
5. **Cross-agent dependencies:** The Orchestrator tracks these explicitly:
   - Messaging Agent needs Auth & User Agent's session middleware (Phase 1)
   - Admin Agent needs Messaging Agent's conversation/flag models (Phase 3)
   - Data & Matching Agent needs Auth & User Agent's profile data (Phase 2)

### Agent Concurrency Map

```
Phase 0:  [Auth&User]──────────────────
          [Data&Matching]──────────────  (parallel)
          [Messaging]──────────────────

Phase 1:  [Auth&User: P1.4→P1.5,P1.8]─────────────────
          [Data&Matching: P1.1→P1.2,P1.3]──────────────  (parallel streams)
          [Messaging: P1.7]─────────────────────────────

Phase 2:  [Auth&User: P2.1→P2.2→P2.3,P2.4,P2.8,P2.9]────
          [Data&Matching: P2.5→P2.6→P2.7]─────────────────  (parallel)

Phase 3:  [Messaging: P3.1→P3.2→P3.3→P3.4→P3.5,P3.6,P3.7]────
          [Admin: P3.8→P3.9,P3.10→P3.11,P3.12,P3.13,P3.14]────  (parallel)
          [Data&Matching: P3.15]────────────────────────────────

Phase 4+: All agents converge for integration, QA, launch.
```

---

## 4. Critic Loop Iterations

### Iteration 1 — Initial Review

#### Auditor Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| A1 | Missing password reset flow — PRD has email/password auth but no reset mechanism defined | High | Added P1.8: password reset flow |
| A2 | Missing account deactivation — `User.status` has `deactivated` enum but no user-facing flow | Medium | Added P2.9: account deactivation |
| A3 | Missing server-side analytics events — PRD Section 9 defines success metrics but plan had no event tracking | High | Added P3.15: analytics event table + logging |
| A4 | `ConversationMember.last_read_at` needed for unread message count on conversation list | Medium | Already in revised data model |
| A5 | Problem statement admin CRUD missing — PRD says "add/edit/retire without a deploy" | High | Added P3.14: admin problem statement CRUD |

#### Security Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S1 | No rate limiting defined — brute force risk on login/signup | High | Added P1.9: rate limiting middleware |
| S2 | Message body XSS — user-generated content in messages needs sanitization | High | Added sanitization note to P3.2 |
| S3 | Admin route protection not explicit — need middleware checking `is_admin` | High | Added to P3.8 description |
| S4 | `is_admin` escalation — no API endpoint should allow setting this field | Medium | Excluded from all user-facing update APIs |
| S5 | Email enumeration on signup/login — generic error messages needed | Medium | Added to P5.1 security audit |

#### Implementation Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| I1 | Email batching needs a queue mechanism — what handles the 15-min window? | Medium | In-memory debounce map per recipient (acceptable for MVP; server restart = at worst an extra email) |
| I2 | Matching query performance at 5K users needs benchmarking | Medium | Added P5.2: explicit performance test with target <500ms p95 |
| I3 | All list endpoints need pagination from day one | Medium | Added pagination requirement to P2.6, P3.3, P3.9 |

#### Observability Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| O1 | No logging strategy defined | High | Added P0.9: structured logging with pino + request ID middleware |
| O2 | No health check endpoint | Medium | Added P1.10: `/api/health` endpoint |
| O3 | No matching engine performance tracking | Medium | Added query time logging to matching engine |

**Changes applied:** 8 new tasks added (P0.9, P1.8, P1.9, P1.10, P2.9, P3.13, P3.14, P3.15). Multiple task descriptions updated.

---

### Iteration 2 — Post-Revision Review

#### Auditor Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| A6 | Suspended user messaging behavior undefined — what happens to in-flight conversations? | Medium | Added P5.8: suspended users can't send; conversations show "account suspended" state |

#### Security Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| S6 | Conversation access control — users must only read their own conversations; admin reads only flagged | High | Added P4.6: explicit access control verification task |
| S7 | Message deletion should be soft delete for audit trail | Low | Updated P3.11: admin delete uses `deleted_at` timestamp |

#### Implementation Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| I4 | Pagination added — confirmed in P2.6, P3.3, P3.9 | None | No change needed |
| I5 | Plan sequencing verified — no circular dependencies detected | None | No change needed |

#### Observability Critic Findings
| # | Finding | Severity | Resolution |
|---|---------|----------|------------|
| O4 | Request ID middleware should propagate through all log entries | Low | Added to P0.9 description |

**Changes applied:** 2 tasks added (P4.6, P5.8). 2 task descriptions updated. No structural changes.

---

### Iteration 3 — Stability Check

#### Auditor Critic: No new findings. Full PRD requirement coverage confirmed.
#### Security Critic: No new findings. Auth, authorization, input validation, rate limiting all addressed.
#### Implementation Critic: No new findings. Sequencing correct, complexity appropriate for MVP.
#### Observability Critic: No new findings. Health check, logging, request IDs, performance tracking all present.

**Result: Plan stable. No further changes needed.**

---

## 5. Local Dev Setup & Run Commands

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ (local instance or Docker)
- pnpm (preferred) or npm

### Makefile

```makefile
.PHONY: setup dev test seed db-reset db-migrate db-studio lint clean

# One-command setup: installs deps, sets up DB, seeds data
setup:
	@echo "Installing dependencies..."
	pnpm install
	@echo "Setting up environment..."
	cp -n .env.example .env.local || true
	@echo "Creating database..."
	createdb upstream_literacy_dev 2>/dev/null || true
	@echo "Running migrations..."
	pnpm prisma migrate dev
	@echo "Seeding NCES data + problem statements..."
	pnpm run seed
	@echo "Setup complete! Run 'make dev' to start."

# One-command run: starts Next.js dev server
dev:
	pnpm dev

# Run all tests
test:
	pnpm test

# Run tests in watch mode
test-watch:
	pnpm test --watch

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

# Open Prisma Studio (visual DB browser)
db-studio:
	pnpm prisma studio

# Lint + format check
lint:
	pnpm lint && pnpm prettier --check .

# Clean build artifacts
clean:
	rm -rf .next node_modules
```

### .env.example

```bash
# Database
DATABASE_URL="postgresql://localhost:5432/upstream_literacy_dev"

# NextAuth
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NEXTAUTH_URL="http://localhost:3000"

# Resend (email)
RESEND_API_KEY="re_xxxxxxxxxxxx"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Seed Script Overview (`scripts/seed.ts`)

1. Download NCES CCD flat file (or use bundled CSV in `data/nces_districts.csv`)
2. Parse CSV: extract district name, state, NCES ID, locale code, enrollment, FRL%, ELL%
3. Derive `urbanicity` from locale code (12 NCES codes → 4 categories)
4. Derive `size_bucket` from enrollment
5. Upsert ~18,000 districts into `District` table
6. Insert 20 problem statements across 7 categories
7. Optionally create test users with sample profiles (dev only)

### Docker Alternative (optional)

```yaml
# docker-compose.yml
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_DB: upstream_literacy_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

If using Docker for Postgres: `docker compose up -d` then `make setup`.

---

## 6. Risks & Tradeoffs

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Matching query slow at 5K users | Medium | Medium | Benchmark in Phase 5; fallback: add DB indexes on matching fields, or pre-compute nightly |
| NCES data format changes | Low | Medium | Flat file import is version-pinned; annual review when refreshing |
| Railway cold starts on infrequent traffic | Medium | Low | Health check endpoint + free uptime monitor keeps app warm |
| In-memory email debounce lost on restart | Medium | Low | Worst case: duplicate email. Acceptable for MVP. Post-MVP: use Redis or DB-backed queue |
| Polling at 5s × many concurrent users | Low (at MVP scale) | Low | At 5K users, ~1K concurrent max → 200 req/s. Next.js API routes handle this. Monitor and throttle if needed. |

### Product Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Low initial signup volume → sparse matches | High | High | Seed with realistic test profiles; focus launch on 2-3 states for density; lower match threshold if needed |
| Users select all 5 problem statements indiscriminately | Medium | Medium | Cap at 5 already helps; consider showing "you selected 5 — these matches are based on your top priorities" |
| Messaging without moderation tools at scale | Low (MVP) | Medium | Keyword alerts + user flagging cover MVP; add ML-based flagging post-MVP |

### Architectural Tradeoffs

| Decision | What we gain | What we give up |
|----------|-------------|-----------------|
| Next.js full-stack (vs separate API) | Single codebase, fast dev, shared types | Harder to scale API independently later |
| Polling (vs WebSockets) | Simplicity, no infrastructure changes | 5s message delivery delay |
| In-memory email debounce (vs Redis queue) | Zero additional infrastructure | Durability on server restart |
| On-demand matching (vs pre-computed) | Always fresh results, simpler architecture | Slower response on large user base |
| Railway (vs Vercel) | Simple PaaS, managed Postgres in one place | Less Next.js-specific optimization than Vercel |
| Prisma (vs raw SQL) | Type safety, migration management, DX | Slightly less control over complex queries (mitigated by `$queryRaw`) |

---

## 7. Task Summary

| Phase | Tasks | Parallel Streams | Estimated Effort |
|-------|-------|-------------------|-----------------|
| Phase 0: Bootstrap | 9 | 3 | Foundation |
| Phase 1: Foundations | 10 | 4 | Foundation |
| Phase 2: Core Systems | 9 | 2 | Core |
| Phase 3: Features | 15 | 5 | Core |
| Phase 4: Integration | 6 | 1 (sequential) | Validation |
| Phase 5: QA + Hardening | 8 | 2 | Validation |
| Phase 6: Launch | 9 | 2 | Deployment |
| **Total** | **66 tasks** | | |

### Critical Path

```
P0.1 → P0.3 → P1.1 → P1.2 → P2.5 → P2.6 → P2.7 → P3.1 → P3.2 → P3.4 → Phase 4 → Phase 5 → Phase 6
```

The critical path runs through: project setup → schema → NCES import → matching engine → matching API → matching UI → messaging → integration → QA → launch.

Any parallelizable work (auth, admin, email templates, analytics) should not block this path.
