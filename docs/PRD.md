# Product Requirements Document: Upstream Literacy Community

**Version:** 1.0 (MVP)
**Date:** 2026-03-25
**Status:** Draft

---

## 1. Product Overview

### Vision

Upstream Literacy Community is a peer-matching platform that connects district literacy leaders with counterparts in demographically similar districts who are tackling the same challenges. The platform eliminates the isolation that literacy directors, curriculum coordinators, and reading specialists face by automatically surfacing relevant peers based on publicly available district data and self-selected problem statements.

Unlike vendor-hosted communities or generic educator forums, Upstream provides structured, context-aware matching -- so a literacy director in a mid-size suburban district implementing Science of Reading can find and message a peer in a comparable district who has already navigated that transition.

### Problem Statement

District literacy leaders lack a reliable way to find and connect with peers who share both their demographic context (district type, size, poverty level, ELL population) and their specific operational challenges (curriculum adoption, intervention design, staffing). Existing options -- conferences, LinkedIn groups, vendor advisory boards -- are either ephemeral, generic, or commercially biased. Leaders waste time on advice from districts with fundamentally different contexts, or simply go without peer support.

### Target Users

- District Literacy Directors and Chief Academic Officers
- Curriculum & Instruction Coordinators
- District-level Literacy Coaches
- MTSS/RTI Coordinators with literacy responsibility

### Value Proposition

**For literacy leaders:** Find peers who actually understand your context -- same kind of district, same problems -- and start a conversation in minutes, not months.

**For Upstream (the business):** Build a defensible, high-engagement network of literacy decision-makers with clear paths to subscription revenue, professional development upsells, and vendor marketplace monetization.

---

## 2. Core User Personas

### Persona 1: Maria -- District Literacy Director

| Attribute | Detail |
|-----------|--------|
| **Role** | Director of Literacy, K-8, suburban district (~12,000 students) |
| **Goals** | Find a peer who has transitioned from Balanced Literacy to a Science of Reading curriculum in a similar district |
| **Pain Points** | No local peers in her role; conference connections fizzle; vendor reps push products, not honest advice |
| **Current Workaround** | Posts in a Facebook group with 2,000+ members; gets generic replies from people in very different contexts |

### Persona 2: James -- Rural Curriculum Coordinator

| Attribute | Detail |
|-----------|--------|
| **Role** | Curriculum Coordinator, rural district (~2,500 students, high FRL%) |
| **Goals** | Learn how other small, high-poverty districts are staffing literacy intervention with limited budgets |
| **Pain Points** | Geographically isolated; state conferences are expensive to attend; feels invisible to large-district leaders |
| **Current Workaround** | Calls contacts from a grad school cohort; has exhausted those connections |

### Persona 3: Denise -- Platform Moderator (Upstream Staff)

| Attribute | Detail |
|-----------|--------|
| **Role** | Community Manager at Upstream Literacy |
| **Goals** | Monitor conversations for quality, intervene when needed, identify power users |
| **Pain Points** | Needs visibility into messaging without reading every thread; needs to flag inactive or inappropriate accounts |
| **Current Workaround** | N/A (new role) |

---

## 3. Key User Flows

### Flow 1: Onboarding & Profile Creation

```
1. User lands on signup page
2. Creates account (email + password, or SSO via Google)
3. Enters their state → district name (autocomplete from NCES data)
   - System auto-fills: district type (urban/suburban/rural), enrollment,
     FRL%, ELL%, state
   - User confirms or corrects (edge case: charter/new district not in data)
4. User selects their role from dropdown (Literacy Director, Curriculum
   Coordinator, Literacy Coach, MTSS Coordinator, Other)
5. User selects 1-5 problem statements from the taxonomy (multi-select)
6. User adds optional short bio (free text, 280 char max)
7. Profile saved → redirected to dashboard with initial matches
```

### Flow 2: Discovery & Matching

```
1. User views dashboard showing top matches (sorted by match score)
2. Each match card shows:
   - Name, role, district name, state
   - District stats (type, size bucket, FRL%, ELL%)
   - Shared problem statements (highlighted)
   - Match score (e.g., "87% match")
3. User can filter by:
   - District type (urban / suburban / rural)
   - District size range
   - Specific problem statement(s)
   - State or region
4. User can sort by: match score, proximity, recently active
5. User clicks a match card → views full profile
```

### Flow 3: Messaging

```
1. From a user's profile or match card, click "Send Message"
2. Opens 1:1 message thread
3. User types and sends message
4. Recipient receives notification (email + in-app)
5. Conversation continues in threaded view
6. Either user can mute or report the conversation
```

### Flow 4: Admin Moderation

```
1. Admin views moderation dashboard
2. Sees flagged conversations (user-reported or keyword-triggered)
3. Can view message thread
4. Can: warn user, suspend user, delete message, close thread
5. Can view aggregate stats: new signups, active conversations, match rates
```

---

## 4. Functional Requirements (MVP)

### A. User & Profile System

| Requirement | Detail |
|-------------|--------|
| Account creation | Email/password + email verification. Google SSO as stretch. |
| Authentication | JWT-based sessions |
| District selection | Type-ahead search against NCES district list (~18,000 districts) |
| Auto-populated fields | District type (locale code mapped to urban/suburban/rural), enrollment, FRL%, ELL% |
| User-entered fields | Role (dropdown), problem statements (multi-select), bio (optional, 280 char) |
| Profile editing | User can update problem statements and bio at any time |

### B. Data Layer

| Requirement | Detail |
|-------------|--------|
| Data source | NCES Common Core of Data (CCD), accessed via Urban Institute Education Data Portal API or flat-file download |
| Ingestion method | Batch import (annual refresh). Store in local database. No real-time API dependency. |
| Key fields ingested | NCES District ID, district name, state, locale code, total enrollment, FRL count/%, ELL count/% |
| Derived fields | District size bucket (Small: <3K, Medium: 3K-15K, Large: 15K-50K, Very Large: 50K+), urbanicity category (Urban, Suburban, Town, Rural -- collapsed from 12 NCES codes) |

### C. Problem Statement System

| Requirement | Detail |
|-------------|--------|
| Selection type | **Multi-select (1-5)** |
| Justification | Literacy leaders face multiple concurrent challenges. Single-select would under-represent their needs and reduce match surface area. Capping at 5 prevents "select all" abuse and forces prioritization. |
| Taxonomy | See Section 7 |
| Admin capability | Upstream staff can add/edit/retire problem statements without a deploy |

### D. Matching Engine

| Requirement | Detail |
|-------------|--------|
| Matching approach | Rules-based weighted scoring (no ML) |
| Calculation | On-demand per user request (not pre-computed for MVP) |
| Criteria & weights | See Section 6 |
| Output | Ranked list of users with match score (0-100) |
| Minimum threshold | Only show matches scoring >= 30 |
| Default sort | Match score descending |

### E. Messaging

| Requirement | Detail |
|-------------|--------|
| Type | 1:1 direct messaging only |
| Features | Text messages, timestamps, read receipts |
| Notifications | Email notification on new message (with 15-min batching to avoid spam) |
| Limits | No file attachments for MVP |
| Reporting | User can flag a conversation for admin review |

### F. Admin / Moderation

| Requirement | Detail |
|-------------|--------|
| Dashboard | View all users, conversations flagged for review, basic platform stats |
| Conversation access | Admin can read any flagged message thread |
| Actions | Warn user (sends email), suspend user (blocks login), delete individual messages |
| Stats | Total users, active users (7-day), messages sent (7-day), avg match score, flagged conversations |
| Keyword alerts | Optional: flag messages containing configurable keyword list |

---

## 5. Data Model

### Entities & Key Fields

```
┌──────────────────┐       ┌──────────────────┐
│     District      │       │ ProblemStatement  │
├──────────────────┤       ├──────────────────┤
│ id (PK)           │       │ id (PK)           │
│ nces_id (unique)  │       │ label             │
│ name              │       │ category          │
│ state             │       │ active (bool)     │
│ locale_code       │       │ created_at        │
│ urbanicity        │       └──────────────────┘
│ total_enrollment  │
│ size_bucket       │       ┌──────────────────┐
│ frl_pct           │       │ UserProblem (M2M) │
│ ell_pct           │       ├──────────────────┤
│ updated_at        │       │ user_id (FK)      │
└──────┬───────────┘       │ problem_id (FK)   │
       │ 1:N                │ selected_at       │
       │                    └──────────────────┘
┌──────┴───────────┐
│      User         │       ┌──────────────────┐
├──────────────────┤       │     Message        │
│ id (PK)           │       ├──────────────────┤
│ email (unique)    │       │ id (PK)           │
│ password_hash     │       │ conversation_id   │
│ name              │       │ sender_id (FK)    │
│ role              │       │ body              │
│ bio               │       │ sent_at           │
│ district_id (FK)  │       │ read_at           │
│ is_admin (bool)   │       │ flagged (bool)    │
│ status (enum)     │       └──────────────────┘
│ created_at        │
│ last_active_at    │       ┌──────────────────┐
└──────────────────┘       │   Conversation    │
                            ├──────────────────┤
                            │ id (PK)           │
                            │ user_a_id (FK)    │
                            │ user_b_id (FK)    │
                            │ created_at        │
                            │ status (enum)     │
                            └──────────────────┘
```

### Relationships

- **User** belongs to one **District** (many users per district is allowed)
- **User** has many **ProblemStatements** (via UserProblem join table, max 5)
- **Conversation** connects exactly two **Users**
- **Message** belongs to one **Conversation** and one **User** (sender)

### Enums

- `User.status`: `active`, `suspended`, `deactivated`
- `Conversation.status`: `active`, `muted`, `closed`, `flagged`
- `User.role`: `literacy_director`, `curriculum_coordinator`, `literacy_coach`, `mtss_coordinator`, `other`
- `District.urbanicity`: `urban`, `suburban`, `town`, `rural`
- `District.size_bucket`: `small`, `medium`, `large`, `very_large`

---

## 6. Matching Logic

### Weighted Scoring Model

| Factor | Weight | Scoring Logic |
|--------|--------|---------------|
| **Problem Statement Overlap** | **40%** | `(shared_problems / max(user_a_problems, user_b_problems)) * 40` |
| **District Size Similarity** | **20%** | Same bucket = 20; adjacent bucket = 10; 2+ apart = 0 |
| **Urbanicity Match** | **20%** | Exact match = 20; adjacent (e.g., suburban-town) = 10; opposite (urban-rural) = 0 |
| **FRL% Similarity** | **10%** | `max(0, 10 - abs(a.frl_pct - b.frl_pct) / 5)` (within 50 percentage points scales linearly) |
| **ELL% Similarity** | **10%** | `max(0, 10 - abs(a.ell_pct - b.ell_pct) / 3)` (within 30 percentage points scales linearly) |

**Total Score** = sum of all factors, normalized to 0-100.

### Design Rationale

Problem overlap is weighted highest (40%) because leaders primarily want to talk to peers working on the same challenge. Demographic similarity is secondary -- it provides context relevance but is not the primary reason to connect. FRL% and ELL% are lower-weighted refinements that improve match quality without dominating.

### Example Match Scenarios

**Scenario 1: Strong Match (Score: 88)**

| | Maria | Match: Sarah |
|-|-------|-------------|
| District | Suburban, Medium (12K), FRL 32%, ELL 18% | Suburban, Medium (9K), FRL 28%, ELL 15% |
| Problems | Science of Reading, Curriculum Adoption, Coaching Model | Science of Reading, Coaching Model, Assessment System |

- Problem overlap: 2/3 = 26.7
- Size: same bucket = 20
- Urbanicity: exact = 20
- FRL: \|32-28\|=4 → 10 - 4/5 = 9.2
- ELL: \|18-15\|=3 → 10 - 3/3 = 9.0
- **Total: 84.9 → displayed as 85**

**Scenario 2: Moderate Match (Score: 53)**

| | James | Match: Linda |
|-|-------|-------------|
| District | Rural, Small (2.5K), FRL 68%, ELL 8% | Town, Small (4K), FRL 55%, ELL 12% |
| Problems | Staffing & Retention, Intervention Fidelity | Staffing & Retention, Budget Constraints, Coaching Model |

- Problem overlap: 1/3 = 13.3
- Size: same bucket = 20
- Urbanicity: adjacent (rural-town) = 10
- FRL: \|68-55\|=13 → 10 - 13/5 = 7.4
- ELL: \|8-12\|=4 → 10 - 4/3 = 8.7
- **Total: 59.4 → displayed as 59**

**Scenario 3: Weak Match (Score: 28 -- below threshold)**

| | Maria | Non-match: Kevin |
|-|-------|-----------------|
| District | Suburban, Medium (12K), FRL 32%, ELL 18% | Urban, Very Large (180K), FRL 72%, ELL 45% |
| Problems | Science of Reading, Curriculum Adoption, Coaching Model | Budget Constraints, Leadership Turnover |

- Problem overlap: 0/3 = 0
- Size: 2+ apart = 0
- Urbanicity: adjacent (suburban-urban) = 10
- FRL: \|32-72\|=40 → 10 - 40/5 = 2.0
- ELL: \|18-45\|=27 → 10 - 27/3 = 1.0
- **Total: 13.0 → not shown (below 30 threshold)**

---

## 7. Problem Statement Taxonomy

### Category 1: Curriculum & Instruction

1. **Adopting a new core reading/ELA curriculum** -- Evaluating, selecting, and rolling out a new program
2. **Implementing Science of Reading practices** -- Shifting instruction to structured/explicit phonics
3. **Aligning literacy instruction across grade bands** -- Ensuring K-2 foundational skills connect to 3-5+ comprehension
4. **Building knowledge-rich content into ELA** -- Integrating science/social studies content with literacy

### Category 2: Assessment & Data

5. **Selecting or implementing a universal literacy screener** -- DIBELS, Star, AimsWeb, or similar
6. **Using data to drive intervention placement** -- Translating assessment results into instructional action
7. **Implementing dyslexia screening mandates** -- Compliance with state-level screening laws
8. **Building a coherent assessment system** -- Connecting diagnostic, formative, and summative assessments

### Category 3: Intervention & MTSS

9. **Designing or improving an MTSS framework for literacy** -- Tier structure, decision rules, progress monitoring
10. **Selecting and managing intervention programs** -- Tier 2/3 materials and fidelity
11. **Ensuring intervention fidelity across schools** -- Consistent implementation at scale

### Category 4: Professional Development & Coaching

12. **Retraining teachers in evidence-based literacy practices** -- Moving away from three-cueing, leveled readers
13. **Building a literacy coaching model** -- Hiring, training, and deploying instructional coaches
14. **Sustaining job-embedded professional learning** -- Beyond one-off workshops

### Category 5: Staffing & Leadership

15. **Recruiting and retaining reading specialists** -- Staffing pipelines for specialized roles
16. **Maintaining initiative continuity through leadership turnover** -- Protecting multi-year literacy plans
17. **Building principal buy-in for literacy initiatives** -- Instructional leadership at the building level

### Category 6: Equity & Special Populations

18. **Supporting English Language Learners in literacy** -- Biliteracy, dual language, ELL-specific strategies
19. **Closing literacy gaps for high-poverty populations** -- Targeted strategies for high-FRL districts

### Category 7: Policy & Compliance

20. **Navigating state Science of Reading mandates** -- Timelines, approved materials lists, reporting

---

## 8. MVP Scope vs. Future

### MVP (Build Now)

- Email/password authentication
- District lookup with NCES data auto-fill (batch import)
- Profile creation with role, problem statements, bio
- Rules-based matching engine with weighted scoring
- Match discovery dashboard with filters and sort
- 1:1 messaging with email notifications
- Basic admin dashboard (user list, flagged conversations, platform stats)
- Responsive web app (mobile-friendly, not native)

### Deferred (Post-MVP)

| Feature | Rationale for Deferral |
|---------|----------------------|
| Google/SSO login | Nice-to-have; email/password is sufficient for MVP |
| Group messaging / forums | Adds significant complexity; validate 1:1 engagement first |
| Discussion boards or feed | Community features beyond matching are a separate product surface |
| In-app video/audio calls | Use messaging to coordinate; users can share Zoom links |
| File/resource sharing | Liability and moderation complexity; defer until trust patterns emerge |
| Vendor marketplace | Revenue opportunity but requires supply-side development |
| Professional development courses | Separate product vertical |
| Mobile native apps | Responsive web first; native only if engagement warrants it |
| ML-based matching | Rules-based is sufficient and explainable for MVP; ML adds opacity and infra cost |
| Real-time data API integration | Batch import is adequate given NCES updates annually |
| District-level analytics / reporting | Useful for enterprise sales but not needed for community MVP |
| Gamification (badges, points) | Premature; validate core value prop first |
| Email digest of new matches | Retention feature for post-launch |
| Profile verification (confirm district employment) | Trust feature for scale; manual admin review is fine at launch |
| Multi-language support | English only for MVP |

---

## 9. Success Metrics

### Primary Metrics (North Stars)

| Metric | Definition | MVP Target (90 days) |
|--------|-----------|---------------------|
| **Activation Rate** | % of signups who complete profile (district + problems selected) | > 60% |
| **Match Engagement Rate** | % of activated users who view at least 3 match profiles | > 40% |
| **Message Initiation Rate** | % of activated users who send at least 1 message | > 25% |
| **Conversation Depth** | % of initiated conversations with 3+ messages exchanged | > 50% |

### Secondary Metrics

| Metric | Definition | MVP Target (90 days) |
|--------|-----------|---------------------|
| **D7 Retention** | % of activated users who return within 7 days | > 30% |
| **D30 Retention** | % of activated users who return within 30 days | > 20% |
| **Matches per User** | Avg number of matches above threshold per user | > 10 |
| **Time to First Message** | Median time from profile completion to first message sent | < 48 hours |
| **Moderation Rate** | % of conversations flagged | < 2% (health indicator) |

### Tracking Assumptions

- All metrics tracked via server-side events (no dependency on client-side analytics for core metrics)
- Admin dashboard includes a simple metrics view for the above
- No third-party analytics tool required for MVP (build minimal internal tracking)

---

## Appendix A: Technical Assumptions

| Assumption | Detail |
|------------|--------|
| **Stack** | TBD by developer (brief specifies) |
| **Hosting** | Cloud-hosted (AWS, GCP, or Vercel -- developer's choice) |
| **Data refresh** | NCES data imported at build time or via admin-triggered batch job; refreshed annually |
| **Scale target** | MVP designed for < 5,000 users; no need for horizontal scaling at launch |
| **Search** | Database-level queries sufficient for MVP (no Elasticsearch needed) |
| **Matching computation** | Calculated on-the-fly per request against all active users; pagination handles display. If performance degrades past 5K users, pre-compute nightly. |

## Appendix B: Public Data Source Reference

| Source | URL | Fields Used |
|--------|-----|-------------|
| NCES Common Core of Data | nces.ed.gov/ccd | District name, state, locale code, enrollment, FRL%, ELL% |
| Urban Institute Education Data Portal | educationdata.urban.org | API wrapper for CCD (easier programmatic access) |
| NCES EDGE Program | nces.ed.gov/programs/edge | Geographic data (stretch: proximity matching) |

## Appendix C: Competitive Landscape

| Competitor | Category | Gap for This Use Case |
|-----------|----------|----------------------|
| **Lexia Learning** (Cambium/IXL) | Literacy platform | Product company, not a community. No peer matching. |
| **Amplify** | Curriculum & assessment | Customer forums are product support, not peer networks. |
| **Renaissance** (Star) | Assessment & data | Comparative data dashboards but no way to connect with peer districts. |
| **Newsela** | Content platform | No community or peer discovery features. |
| **EdReports** | Curriculum reviews | One-directional resource; no interaction between districts. |
| **Panorama Education** | MTSS platform | Strong data tools but no cross-district networking. |
| **Branching Minds** | MTSS platform | Within-district tooling only; no peer matching. |

**Key insight:** No existing player combines demographic-aware peer matching with literacy-specific problem statements. This is genuine whitespace.
