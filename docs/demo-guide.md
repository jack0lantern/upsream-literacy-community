# Demo Guide: Upstream Literacy Community

Use this script to walk someone through the MVP locally or on a staging deploy. Pair it with [seed-accounts.md](./seed-accounts.md) for exact credentials and persona data.

---

## Before you demo

1. **Environment:** From the `app/` directory, PostgreSQL must be running and the DB migrated + seeded.
2. **First-time setup:**

   ```bash
   cd app
   make setup
   ```

3. **Start the app:**

   ```bash
   make run
   ```

4. **Open:** [http://localhost:3000](http://localhost:3000) (root redirects to `/dashboard`; unauthenticated users are sent to sign-in).

5. **Email:** Outbound mail (Resend) may be disabled or misconfigured locally. Treat notifications as a “production/staging only” talking point unless you have verified `RESEND_*` in `.env.local`.

---

## Accounts to use

| Persona | Email | Password | Notes |
|--------|--------|----------|--------|
| **Platform admin** | `admin@upstream.dev` | `admin123` | Moderation and configuration |
| **Typical literacy leader** | `maria.santos@jefferson.edu` | `password123` | Suburban large district; Science of Reading / PD challenges |
| **Large urban peer** | `james.oconnor@lausd.edu` | `password123` | Good contrast for match cards (CA, very large, urban) |
| **Second user for messaging** | `derek.washington@springfield186.edu` | `password123` | Same password; use in a second browser or incognito for a live thread |

Full table (15 demo users + roles, districts, challenges): [seed-accounts.md](./seed-accounts.md).

---

## Suggested flow (10–15 minutes)

### 1. Problem and product (1 min)

- **One-liner:** Peer matching for district literacy leaders using NCES-style district attributes plus self-selected “problem statements,” so matches are context-aware, not random forum posts.
- **Audience:** Directors, coordinators, coaches, MTSS leads—not classroom teachers as the primary persona.

### 2. Literacy leader experience (~8 min)

1. Sign in at `/login` as **Maria Santos** (`maria.santos@jefferson.edu` / `password123`).
2. **Dashboard** (`/dashboard`): Show ranked matches, shared problems, district stats (size, urbanicity, FRL/ELL where shown), and match score. Mention the score combines problem overlap with district similarity (per PRD weights).
3. **Filters / sort** (if present in UI): Narrow by problem, district type, or state; sort by match score or recency.
4. Open a **peer profile** (`/profile/[id]`): Role, district, bio, problems—this is the “why this person” story.
5. **Start or open a conversation:** From a match or profile, show **Messages** (`/messages`, `/messages/[id]`). Send a short realistic message (e.g., asking about SoR rollout timeline).
6. **Second browser / incognito:** Log in as **Derek** or **James**, open Messages, reply—show the thread updating (polling-based in MVP).

Optional: **Profile** (`/profile`)—show how a user’s district and problems drive matching.

### 3. Onboarding path (~2 min, optional)

- Sign out. Open `/signup`, create a throwaway user, or describe seeded users as “post-onboarding.”
- `/onboarding`: District selection (NCES-backed autocomplete), role, 1–5 problems, optional bio—tie each step back to “what the matcher uses.”

### 4. Admin / moderation (~3 min)

Sign in as **admin@upstream.dev** / `admin123`.

| Area | Path | What to show |
|------|------|----------------|
| Admin home | `/admin` | Entry point to tools |
| Flagged content | `/admin/flagged`, `/admin/flagged/[id]` | Reported or flagged threads/messages |
| Users | `/admin/users` | Account status, support actions |
| Taxonomy | `/admin/problems` | Problem statements used in onboarding and matching |
| Keywords | `/admin/keywords` | Moderation / automation hooks |
| Reports | `/admin/reports` | Aggregated reporting if populated |

Keep this section high level unless your audience is internal ops.

---

## Talking points (matching)

- Matches below the configured minimum score are hidden—explain as “quality bar, not infinite scroll.”
- District data is **public NCES-style** fields; the differentiator is **shared operational problems** (curriculum, MTSS, PD, equity, policy).
- **Not** a social network for everyone—it’s structured professional peer matching.

---

## Troubleshooting during a demo

| Symptom | What to check |
|---------|----------------|
| Empty matches | Seed ran (`make seed` or `make setup`); user completed onboarding with problems selected |
| Redirect loop or 401 | Session/cookies; try incognito; confirm `NEXTAUTH_*` secrets in `.env.local` |
| No admin pages | User must have admin flag (seed admin account does) |
| Messages not updating | Expected with polling interval; refresh or wait a few seconds |

---

## After the demo

- Point stakeholders at [PRD.md](./PRD.md) for scope and [implementation-plan.md](./implementation-plan.md) for technical decisions.
- For hands-on testers, share [seed-accounts.md](./seed-accounts.md) under the same password hygiene rules you use for any shared dev environment.
