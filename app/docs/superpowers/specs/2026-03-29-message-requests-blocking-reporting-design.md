# Message Requests, Blocking & Reporting — Design Spec

**Date:** 2026-03-29
**Status:** Approved

## Overview

Three safety and trust features implemented in parallel:

1. **Message Requests** — first contact requires recipient acceptance before further messages
2. **User Blocking** — a user can block another, closing existing conversations and preventing future contact
3. **Reporting** — users can report specific messages; admins review and can dismiss or suspend the reported user

---

## 1. Schema Changes

### Extend `ConversationStatus` enum

Add two new values to the existing enum:

```prisma
enum ConversationStatus {
  pending   // awaiting recipient acceptance
  active    // accepted / ongoing
  closed    // blocked or manually closed
  flagged   // keyword-flagged, under admin review
  rejected  // recipient declined; message preserved, no further contact
}
```

### New `UserBlock` model

```prisma
model UserBlock {
  id        String   @id @default(cuid())
  blockerId String   @map("blocker_id")
  blockedId String   @map("blocked_id")
  createdAt DateTime @default(now()) @map("created_at")

  blocker User @relation("BlocksGiven", fields: [blockerId], references: [id], onDelete: Cascade)
  blocked User @relation("BlocksReceived", fields: [blockedId], references: [id], onDelete: Cascade)

  @@unique([blockerId, blockedId])
  @@index([blockedId])
  @@map("user_blocks")
}
```

### New `Report` model

```prisma
enum ReportStatus {
  pending
  dismissed
  actioned
}

model Report {
  id             String       @id @default(cuid())
  reporterId     String       @map("reporter_id")
  reportedUserId String       @map("reported_user_id")
  messageId      String       @map("message_id")
  reason         String       @db.VarChar(500)
  status         ReportStatus @default(pending)
  reviewedById   String?      @map("reviewed_by_id")
  reviewedAt     DateTime?    @map("reviewed_at")
  createdAt      DateTime     @default(now()) @map("created_at")

  reporter     User     @relation("ReportsFiled", fields: [reporterId], references: [id], onDelete: Cascade)
  reportedUser User     @relation("ReportsAgainst", fields: [reportedUserId], references: [id], onDelete: Cascade)
  message      Message  @relation(fields: [messageId], references: [id], onDelete: Cascade)
  reviewedBy   User?    @relation("ReportsReviewed", fields: [reviewedById], references: [id], onDelete: SetNull)

  @@index([status])
  @@index([reportedUserId])
  @@map("reports")
}
```

### `User` model additions

```prisma
blocksGiven      UserBlock[] @relation("BlocksGiven")
blocksReceived   UserBlock[] @relation("BlocksReceived")
reportsFiled     Report[]    @relation("ReportsFiled")
reportsAgainst   Report[]    @relation("ReportsAgainst")
reportsReviewed  Report[]    @relation("ReportsReviewed")
```

---

## 2. Message Requests

### Behavior

- A user sending a first message to someone they have no `active` conversation with creates a conversation in `pending` state.
- The initial message body is required at conversation creation time (sent atomically with the conversation).
- The sender cannot send additional messages while the conversation is `pending` — the message input is disabled with a "Waiting for acceptance" note.
- The recipient sees a **Requests** tab in the messages page, separate from active conversations, with a badge showing the pending count.
- On each request the recipient can **Accept** or **Decline**:
  - Accept → conversation status becomes `active`; normal messaging resumes
  - Decline → conversation status becomes `rejected`; the initial message is preserved and visible to the recipient only; the sender sees nothing (request simply never converted)
- A `rejected` conversation cannot be re-opened. The sender cannot initiate a new request to the same recipient.
- If the sender has been blocked by the recipient, `POST /api/conversations` returns 403 before creating anything.

### API Changes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/conversations` | Add required `body` param; enforce block check; check for existing `rejected` conversation (return 403 if found); create conversation + first message atomically in `pending` state |
| `PATCH` | `/api/conversations/[id]` | New endpoint — accept or reject a pending request (recipient only). Body: `{ action: "accept" | "reject" }` |
| `GET` | `/api/conversations?type=requests` | Returns `pending` conversations where current user is the recipient |

### UI Changes

- `messages/page.tsx` — add **Requests** tab alongside the existing list; badge on tab with count
- Conversation view — disable message input + show note when conversation is `pending` (sender view)
- Request card in Requests tab — shows sender name, district, initial message excerpt, Accept / Decline buttons

---

## 3. User Blocking

### Behavior

- Block is available from: the conversation view header menu, and a user's profile page. Not shown on match cards.
- `POST /api/users/[id]/block` atomically:
  1. Creates `UserBlock` record
  2. Finds any `active` or `pending` conversation between the two users and sets its status to `closed`
- The block is silent — the blocked user receives no notification.
- `DELETE /api/users/[id]/block` removes the block. The closed conversation stays closed; a new message request would start a fresh conversation.

### Server-side guards

All enforced in API handlers, not just the UI:

- `POST /api/conversations` — reject with 403 if recipient has blocked sender
- `POST /api/conversations/[id]/messages` — reject with 403 if either party has blocked the other
- `GET /api/conversations` — exclude conversations where the other party has blocked the current user

### API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/users/[id]/block` | Block a user; close any shared active/pending conversation |
| `DELETE` | `/api/users/[id]/block` | Unblock a user |
| `GET` | `/api/users/[id]/block` | Check if current user has blocked this user (for UI state) |

Blocks are private — no admin visibility.

---

## 4. Reporting

### Behavior

- A "Report" option appears in the message context menu (hover/overflow on each message bubble).
- Clicking opens a modal with: message preview, sender name, and a required free-text reason field (max 500 chars).
- `POST /api/reports` creates a `Report` record with `status: pending`. Confirmation toast shown to reporter.
- Reporting does **not** auto-block, auto-flag the conversation, or notify the reported user.
- Multiple reports against the same user from the same reporter are allowed (each message is a separate report).

### Admin Review (`/admin/reports`)

- New page in the admin panel, listed alongside `/admin/flagged` in the nav.
- Lists all `pending` reports with: reporter name, reported user name, message excerpt, reason, timestamp.
- Each report links to the full conversation for context.
- Admin nav badge shows count of pending reports.

**Admin actions:**

| Action | API | Effect |
|--------|-----|--------|
| Dismiss | `PATCH /api/admin/reports/[id]` `{ action: "dismiss" }` | Sets report `status: dismissed` |
| Suspend user | `PATCH /api/admin/reports/[id]` `{ action: "suspend" }` | Sets reported user `status: suspended`; sets report `status: actioned` |

Deactivation of users continues to be handled via the existing `/admin/users` panel.

### API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/reports` | File a report against a message/sender |
| `GET` | `/api/admin/reports` | List reports (admin only); supports `?status=pending` filter |
| `PATCH` | `/api/admin/reports/[id]` | Dismiss or action a report (admin only) |

---

## 5. Parallel Implementation Tracks

The three features are independent and can be built in parallel:

| Track | Dependencies |
|-------|-------------|
| Message Requests | Schema migration (ConversationStatus enum) |
| Blocking | Schema migration (UserBlock model) |
| Reporting | Schema migration (Report model, ReportStatus enum) |

All three share a single migration. The migration should be written and run before any track starts implementation.
