# Message Requests, Blocking & Reporting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add message request gating (first message requires acceptance), user blocking (closes existing conversations), and per-message reporting with admin review.

**Architecture:** Extend `ConversationStatus` with `pending`/`rejected` states; add `UserBlock` and `Report` models. All existing-file changes are batched into Track A to avoid merge conflicts; Tracks B and C create new files only. All tracks depend on Phase 0 (shared migration + test infrastructure).

**Tech Stack:** Next.js 16 App Router, Prisma 7, TypeScript, Vitest + in-memory mock-db, Tailwind CSS + shadcn/ui

**Spec:** `docs/superpowers/specs/2026-03-29-message-requests-blocking-reporting-design.md`

---

## Parallel Execution Map

```
Phase 0 (Tasks 1–3) — must complete first
    ├── Track A (Tasks A1–A7): All existing-file modifications
    ├── Track B (Tasks B1–B2): New blocking route
    └── Track C (Tasks C1–C5): New reporting routes + admin UI
```

---

## File Map

**Phase 0 (shared foundation):**
- Modify: `app/prisma/schema.prisma`
- Modify: `app/src/__tests__/mock-db.ts`
- Modify: `app/src/__tests__/helpers.ts`

**Track A (existing file modifications):**
- New: `app/src/__tests__/message-requests.test.ts`
- Modify: `app/src/app/api/conversations/route.ts`
- Modify: `app/src/app/api/conversations/[id]/route.ts`
- Modify: `app/src/app/api/messages/route.ts`
- Modify: `app/src/app/(dashboard)/messages/page.tsx`
- Modify: `app/src/app/(dashboard)/messages/[id]/page.tsx`

**Track B (new files):**
- New: `app/src/__tests__/blocking.test.ts`
- New: `app/src/app/api/users/[id]/block/route.ts`

**Track C (new files):**
- New: `app/src/__tests__/reporting.test.ts`
- New: `app/src/app/api/reports/route.ts`
- New: `app/src/app/api/admin/reports/route.ts`
- New: `app/src/app/api/admin/reports/[id]/route.ts`
- New: `app/src/app/admin/reports/page.tsx`
- Modify: `app/src/app/admin/layout.tsx`

---

## Phase 0: Shared Foundation

### Task 1: Update Prisma schema

**Files:**
- Modify: `app/prisma/schema.prisma`

- [ ] **Step 1: Add `pending` and `rejected` to `ConversationStatus` enum**

  Replace the existing `ConversationStatus` enum:
  ```prisma
  enum ConversationStatus {
    pending
    active
    closed
    flagged
    rejected
  }
  ```

- [ ] **Step 2: Add `UserBlock` model after the `User` model block**

  ```prisma
  // ─── UserBlock ───────────────────────────────────────────────────────────────

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

- [ ] **Step 3: Add `ReportStatus` enum and `Report` model**

  Add after the `UserBlock` model:
  ```prisma
  enum ReportStatus {
    pending
    dismissed
    actioned
  }

  // ─── Report ──────────────────────────────────────────────────────────────────

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

    reporter     User    @relation("ReportsFiled", fields: [reporterId], references: [id], onDelete: Cascade)
    reportedUser User    @relation("ReportsAgainst", fields: [reportedUserId], references: [id], onDelete: Cascade)
    message      Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
    reviewedBy   User?   @relation("ReportsReviewed", fields: [reviewedById], references: [id], onDelete: SetNull)

    @@index([status])
    @@index([reportedUserId])
    @@map("reports")
  }
  ```

- [ ] **Step 4: Add relations to the `User` model**

  Inside the `User` model, after the existing relations, add:
  ```prisma
  blocksGiven     UserBlock[] @relation("BlocksGiven")
  blocksReceived  UserBlock[] @relation("BlocksReceived")
  reportsFiled    Report[]    @relation("ReportsFiled")
  reportsAgainst  Report[]    @relation("ReportsAgainst")
  reportsReviewed Report[]    @relation("ReportsReviewed")
  ```

- [ ] **Step 5: Add `reports` relation to `Message` model**

  Inside the `Message` model, after the existing relations:
  ```prisma
  reports Report[]
  ```

- [ ] **Step 6: Commit**

  ```bash
  cd app && git add prisma/schema.prisma
  git commit -m "feat(schema): add pending/rejected conversation states, UserBlock, Report models"
  ```

---

### Task 2: Run migration

**Files:**
- Generated: `app/prisma/migrations/[timestamp]_message_requests_blocking_reporting/`

- [ ] **Step 1: Run the migration**

  ```bash
  cd app && npx prisma migrate dev --name message_requests_blocking_reporting
  ```
  Expected: Migration created and applied. Prisma client regenerated.

- [ ] **Step 2: Verify Prisma client compiles**

  ```bash
  cd app && npx tsc --noEmit
  ```
  Expected: No errors related to new models.

- [ ] **Step 3: Commit**

  ```bash
  cd app && git add prisma/migrations/
  git commit -m "feat(db): migration for message requests, blocking, reporting"
  ```

---

### Task 3: Update test infrastructure (mock-db + helpers)

**Files:**
- Modify: `app/src/__tests__/mock-db.ts`
- Modify: `app/src/__tests__/helpers.ts`

- [ ] **Step 1: Add `MockUserBlock` and `MockReport` interfaces to `mock-db.ts`**

  After the `MockKeywordAlert` interface, add:
  ```typescript
  export interface MockUserBlock {
    id: string;
    blockerId: string;
    blockedId: string;
    createdAt: Date;
  }

  export interface MockReport {
    id: string;
    reporterId: string;
    reportedUserId: string;
    messageId: string;
    reason: string;
    status: string;
    reviewedById: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
  }
  ```

- [ ] **Step 2: Add `userBlocks` and `reports` to the `stores` object**

  In the `stores` declaration, add after `keywordAlerts`:
  ```typescript
  userBlocks: new Map<string, MockUserBlock>(),
  reports: new Map<string, MockReport>(),
  ```

- [ ] **Step 3: Add `userBlock` and `report` proxies to `mockDb`**

  In the `mockDb` object, after `keywordAlert`, add:
  ```typescript
  userBlock: buildModelProxy(stores.userBlocks, () => ({
    createdAt: new Date(),
  })),
  report: buildModelProxy(stores.reports, () => ({
    reviewedById: null,
    reviewedAt: null,
    status: "pending",
    createdAt: new Date(),
  })),
  ```

- [ ] **Step 4: Override `userBlock.findUnique` to support compound key**

  After the `mockDb` declaration, add:
  ```typescript
  // UserBlock compound key support: { blockerId_blockedId: { blockerId, blockedId } }
  const baseUserBlock = mockDb.userBlock;
  baseUserBlock.findUnique = vi.fn(async (args: { where: Record<string, unknown> }) => {
    const w = args.where;
    if (w.blockerId_blockedId) {
      const compound = w.blockerId_blockedId as { blockerId: string; blockedId: string };
      for (const item of stores.userBlocks.values()) {
        if (item.blockerId === compound.blockerId && item.blockedId === compound.blockedId) {
          return item;
        }
      }
      return null;
    }
    for (const item of stores.userBlocks.values()) {
      if (matchesWhere(item, w)) return item;
    }
    return null;
  });
  ```

  Note: `matchesWhere` is defined earlier in the file and is accessible here.

- [ ] **Step 5: Add seed helpers to `helpers.ts`**

  After the `seedKeyword` function, add:
  ```typescript
  export function seedPendingConversation(
    initiatorId: string,
    recipientId: string,
    body: string,
    status: "pending" | "rejected" = "pending"
  ): { conversationId: string; messageId: string } {
    const conversationId = genId();
    const memberAId = genId();
    const memberBId = genId();
    const messageId = genId();

    stores.conversations.set(conversationId, {
      id: conversationId,
      status,
      createdAt: new Date(),
    });
    stores.conversationMembers.set(memberAId, {
      id: memberAId,
      conversationId,
      userId: initiatorId,
      muted: false,
      lastReadAt: null,
      joinedAt: new Date(),
    });
    stores.conversationMembers.set(memberBId, {
      id: memberBId,
      conversationId,
      userId: recipientId,
      muted: false,
      lastReadAt: null,
      joinedAt: new Date(),
    });
    stores.messages.set(messageId, {
      id: messageId,
      conversationId,
      senderId: initiatorId,
      body,
      sentAt: new Date(),
      readAt: null,
      flagged: false,
      deletedAt: null,
    });

    return { conversationId, messageId };
  }

  export function seedBlock(blockerId: string, blockedId: string): string {
    const id = genId();
    stores.userBlocks.set(id, {
      id,
      blockerId,
      blockedId,
      createdAt: new Date(),
    });
    return id;
  }

  export function seedReport(
    reporterId: string,
    reportedUserId: string,
    messageId: string,
    reason = "This is a test report reason."
  ): string {
    const id = genId();
    stores.reports.set(id, {
      id,
      reporterId,
      reportedUserId,
      messageId,
      reason,
      status: "pending",
      reviewedById: null,
      reviewedAt: null,
      createdAt: new Date(),
    });
    return id;
  }
  ```

- [ ] **Step 6: Run existing tests to confirm nothing broke**

  ```bash
  cd app && pnpm test
  ```
  Expected: All existing tests pass.

- [ ] **Step 7: Commit**

  ```bash
  cd app && git add src/__tests__/mock-db.ts src/__tests__/helpers.ts
  git commit -m "test(infra): add UserBlock and Report stores, seed helpers"
  ```

---

## Track A: Message Requests + Existing File Modifications

> Depends on Phase 0 (Tasks 1–3) completing first.

### Task A1: Write tests for message requests

**Files:**
- New: `app/src/__tests__/message-requests.test.ts`

- [ ] **Step 1: Write the test file**

  Create `app/src/__tests__/message-requests.test.ts`:
  ```typescript
  /**
   * Integration Tests: Message Requests
   * - POST /api/conversations creates pending conversation + first message
   * - POST /api/conversations blocked when recipient has blocked sender
   * - POST /api/conversations blocked when rejected conversation exists
   * - POST /api/conversations returns existing active/pending conversation
   * - PATCH /api/conversations/[id] accept → active
   * - PATCH /api/conversations/[id] reject → rejected
   * - PATCH /api/conversations/[id] sender cannot accept own request
   * - PATCH /api/conversations/[id] 400 when not pending
   * - POST /api/messages blocked while conversation is pending
   * - GET /api/conversations excludes pending from default list
   * - GET /api/conversations?type=requests returns pending for recipient
   */
  import { describe, it, expect, beforeEach, vi } from "vitest";
  import { resetStores, stores } from "./mock-db";
  import {
    createRequest,
    parseResponse,
    seedOnboardedUser,
    seedConversation,
    seedPendingConversation,
    seedBlock,
  } from "./helpers";

  const mockAuth = vi.fn();
  vi.mock("@/lib/auth", () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
  }));

  vi.mock("@/lib/rate-limit", () => ({
    rateLimitMessaging: vi.fn().mockReturnValue({ allowed: true, remaining: 29 }),
    rateLimitSignup: vi.fn().mockReturnValue({ allowed: true, remaining: 2 }),
    rateLimitLogin: vi.fn().mockReturnValue({ allowed: true, remaining: 4 }),
  }));

  import {
    GET as conversationsListHandler,
    POST as conversationCreateHandler,
  } from "@/app/api/conversations/route";
  import { PATCH as conversationPatchHandler } from "@/app/api/conversations/[id]/route";
  import { POST as messageSendHandler } from "@/app/api/messages/route";

  function setSession(userId: string) {
    mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
  }

  function makeParams(id: string) {
    return Promise.resolve({ id });
  }

  describe("Message Requests", () => {
    beforeEach(() => {
      resetStores();
      vi.clearAllMocks();
    });

    describe("POST /api/conversations", () => {
      it("creates a pending conversation with first message when body is provided", async () => {
        const userA = await seedOnboardedUser({ name: "Alice" });
        const userB = await seedOnboardedUser({ name: "Bob" });
        setSession(userA.id);

        const req = createRequest("/api/conversations", {
          method: "POST",
          body: { recipientId: userB.id, body: "Hi, want to connect?" },
        });

        const res = await conversationCreateHandler(req);
        const data = await parseResponse(res);

        expect(res.status).toBe(201);
        expect(data.conversationId).toBeDefined();
        expect(stores.conversations.get(data.conversationId)!.status).toBe("pending");
        expect(stores.messages.size).toBe(1);
        expect([...stores.messages.values()][0].body).toBe("Hi, want to connect?");
        expect([...stores.messages.values()][0].senderId).toBe(userA.id);
      });

      it("returns 400 when body is missing", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        setSession(userA.id);

        const req = createRequest("/api/conversations", {
          method: "POST",
          body: { recipientId: userB.id },
        });

        const res = await conversationCreateHandler(req);
        expect(res.status).toBe(400);
      });

      it("returns 403 when recipient has blocked sender", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedBlock(userB.id, userA.id);
        setSession(userA.id);

        const req = createRequest("/api/conversations", {
          method: "POST",
          body: { recipientId: userB.id, body: "Hello!" },
        });

        const res = await conversationCreateHandler(req);
        expect(res.status).toBe(403);
      });

      it("returns 403 when a rejected conversation already exists", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedPendingConversation(userA.id, userB.id, "old request", "rejected");
        setSession(userA.id);

        const req = createRequest("/api/conversations", {
          method: "POST",
          body: { recipientId: userB.id, body: "Trying again!" },
        });

        const res = await conversationCreateHandler(req);
        expect(res.status).toBe(403);
      });

      it("returns existing active conversation without creating a new one", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedConversation(userA.id, userB.id);
        setSession(userA.id);

        const req = createRequest("/api/conversations", {
          method: "POST",
          body: { recipientId: userB.id, body: "Hello again!" },
        });

        const res = await conversationCreateHandler(req);
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.conversationId).toBe(conversationId);
        expect(stores.conversations.size).toBe(1);
      });

      it("returns existing pending conversation without creating a new one", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedPendingConversation(userA.id, userB.id, "first request");
        setSession(userA.id);

        const req = createRequest("/api/conversations", {
          method: "POST",
          body: { recipientId: userB.id, body: "Same request" },
        });

        const res = await conversationCreateHandler(req);
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.conversationId).toBe(conversationId);
        expect(stores.conversations.size).toBe(1);
      });
    });

    describe("PATCH /api/conversations/[id] accept/reject", () => {
      it("recipient can accept → conversation becomes active", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedPendingConversation(userA.id, userB.id, "Hello!");
        setSession(userB.id);

        const req = createRequest(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          body: { action: "accept" },
        });

        const res = await conversationPatchHandler(req, { params: makeParams(conversationId) });
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.status).toBe("active");
        expect(stores.conversations.get(conversationId)!.status).toBe("active");
      });

      it("recipient can reject → conversation becomes rejected", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedPendingConversation(userA.id, userB.id, "Hello!");
        setSession(userB.id);

        const req = createRequest(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          body: { action: "reject" },
        });

        const res = await conversationPatchHandler(req, { params: makeParams(conversationId) });
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.status).toBe("rejected");
        expect(stores.conversations.get(conversationId)!.status).toBe("rejected");
      });

      it("sender cannot accept their own pending request", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedPendingConversation(userA.id, userB.id, "Hello!");
        setSession(userA.id);

        const req = createRequest(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          body: { action: "accept" },
        });

        const res = await conversationPatchHandler(req, { params: makeParams(conversationId) });
        expect(res.status).toBe(403);
      });

      it("returns 400 when accepting a non-pending conversation", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedConversation(userA.id, userB.id);
        setSession(userB.id);

        const req = createRequest(`/api/conversations/${conversationId}`, {
          method: "PATCH",
          body: { action: "accept" },
        });

        const res = await conversationPatchHandler(req, { params: makeParams(conversationId) });
        expect(res.status).toBe(400);
      });
    });

    describe("POST /api/messages pending guard", () => {
      it("blocks sender from sending additional messages while conversation is pending", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedPendingConversation(userA.id, userB.id, "First message");
        setSession(userA.id);

        const req = createRequest("/api/messages", {
          method: "POST",
          body: { conversationId, body: "Second message" },
        });

        const res = await messageSendHandler(req);
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/conversations", () => {
      it("excludes pending conversations from the default list", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedPendingConversation(userA.id, userB.id, "Hello!");
        setSession(userB.id);

        const req = createRequest("/api/conversations");
        const res = await conversationsListHandler(req);
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.every((c: { status: string }) => c.status !== "pending")).toBe(true);
      });

      it("returns pending conversations for type=requests", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedPendingConversation(userA.id, userB.id, "Hello!");
        setSession(userB.id);

        const req = createRequest("/api/conversations?type=requests");
        const res = await conversationsListHandler(req);
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.length).toBe(1);
        expect(data[0].status).toBe("pending");
      });
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they all fail (not yet implemented)**

  ```bash
  cd app && pnpm test src/__tests__/message-requests.test.ts
  ```
  Expected: Multiple failures — route handlers not yet updated.

---

### Task A2: Update `GET /api/conversations`

**Files:**
- Modify: `app/src/app/api/conversations/route.ts`

- [ ] **Step 1: Add `NextRequest` to the GET signature and add block + status filtering**

  Replace the entire `GET` function in `app/src/app/api/conversations/route.ts`:

  ```typescript
  export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const type = request.nextUrl.searchParams.get("type");

    // Fetch all memberships for current user (all statuses)
    const memberships = await db.conversationMember.findMany({
      where: { userId: session.user.id },
      include: {
        conversation: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, name: true, role: true, status: true },
                },
              },
            },
            messages: {
              orderBy: { sentAt: "desc" },
              take: 1,
              where: { deletedAt: null },
              select: {
                id: true,
                body: true,
                sentAt: true,
                senderId: true,
                readAt: true,
              },
            },
          },
        },
      },
    });

    // Fetch IDs of users who have blocked the current user
    const blockerIds = new Set(
      (
        await db.userBlock.findMany({
          where: { blockedId: session.user.id },
          select: { blockerId: true },
        })
      ).map((b) => b.blockerId)
    );

    const conversations = memberships
      .filter((m) => {
        const status = m.conversation.status;
        const otherMember = m.conversation.members.find(
          (cm) => cm.userId !== session.user.id
        );
        const otherUserId = otherMember?.userId ?? "";

        // Requests tab: only pending conversations
        if (type === "requests") {
          return status === "pending";
        }

        // Default list: only active/flagged, excluding blocked-by relationships
        if (status !== "active" && status !== "flagged") return false;
        if (blockerIds.has(otherUserId)) return false;
        return true;
      })
      .map((m) => {
        const otherMember = m.conversation.members.find(
          (cm) => cm.userId !== session.user.id
        );
        const lastMessage = m.conversation.messages[0] ?? null;
        const unreadCutoff = m.lastReadAt ?? new Date(0);

        return {
          id: m.conversation.id,
          status: m.conversation.status,
          muted: m.muted,
          otherUser: otherMember?.user ?? null,
          lastMessage,
          lastReadAt: m.lastReadAt,
          hasUnread:
            lastMessage &&
            lastMessage.senderId !== session.user.id &&
            lastMessage.sentAt > unreadCutoff,
          createdAt: m.conversation.createdAt,
        };
      });

    // Deduplicate by other user (keep most recent)
    const deduped = new Map<string, (typeof conversations)[number]>();
    for (const conv of conversations) {
      const key = conv.otherUser?.id ?? conv.id;
      const existing = deduped.get(key);
      if (!existing) {
        deduped.set(key, conv);
      } else {
        const existingTime =
          existing.lastMessage?.sentAt.getTime() ?? existing.createdAt.getTime();
        const convTime =
          conv.lastMessage?.sentAt.getTime() ?? conv.createdAt.getTime();
        if (convTime > existingTime) deduped.set(key, conv);
      }
    }

    const result = Array.from(deduped.values());
    result.sort((a, b) => {
      const aTime = a.lastMessage?.sentAt.getTime() ?? a.createdAt.getTime();
      const bTime = b.lastMessage?.sentAt.getTime() ?? b.createdAt.getTime();
      return bTime - aTime;
    });

    return NextResponse.json(result);
  }
  ```

- [ ] **Step 2: Fix the existing messaging test — `GET` now requires a `NextRequest`**

  In `app/src/__tests__/messaging.test.ts`, find all calls to `conversationsListHandler()` (no args) and replace with:
  ```typescript
  const req = createRequest("/api/conversations");
  const res = await conversationsListHandler(req);
  ```

- [ ] **Step 3: Run existing messaging tests**

  ```bash
  cd app && pnpm test src/__tests__/messaging.test.ts
  ```
  Expected: All existing tests pass.

- [ ] **Step 4: Commit**

  ```bash
  cd app && git add src/app/api/conversations/route.ts src/__tests__/messaging.test.ts
  git commit -m "feat(api): conversations list filters pending/rejected and blocked relationships"
  ```

---

### Task A3: Update `POST /api/conversations`

**Files:**
- Modify: `app/src/app/api/conversations/route.ts`

- [ ] **Step 1: Add `sanitizeMessageBody` import**

  Add to the imports at the top of `app/src/app/api/conversations/route.ts`:
  ```typescript
  import { sanitizeMessageBody } from "@/lib/sanitize";
  ```

- [ ] **Step 2: Replace the POST handler**

  Replace the entire `POST` function:
  ```typescript
  export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { recipientId, body } = await request.json();
    if (!recipientId) {
      return NextResponse.json({ error: "recipientId is required" }, { status: 400 });
    }
    if (!body || typeof body !== "string" || !body.trim()) {
      return NextResponse.json({ error: "body is required" }, { status: 400 });
    }

    if (recipientId === session.user.id) {
      return NextResponse.json(
        { error: "Cannot create conversation with yourself" },
        { status: 400 }
      );
    }

    const recipient = await db.user.findUnique({
      where: { id: recipientId, status: "active" },
    });
    if (!recipient) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if recipient has blocked sender
    const block = await db.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: recipientId, blockedId: session.user.id } },
    });
    if (block) {
      return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
    }

    // Check for existing conversation (any status)
    const existingMembership = await db.conversationMember.findFirst({
      where: {
        userId: session.user.id,
        conversation: { members: { some: { userId: recipientId } } },
      },
      include: { conversation: { select: { id: true, status: true } } },
    });

    if (existingMembership?.conversation) {
      const { id: existingId, status } = existingMembership.conversation;
      if (status === "rejected") {
        return NextResponse.json(
          { error: "Cannot send another request to this user" },
          { status: 403 }
        );
      }
      return NextResponse.json({ conversationId: existingId }, { status: 200 });
    }

    const sanitizedBody = sanitizeMessageBody(body.trim());
    if (!sanitizedBody.trim()) {
      return NextResponse.json(
        { error: "Message body is empty after sanitization" },
        { status: 400 }
      );
    }

    const { conversationId } = await db.$transaction(async (tx) => {
      const conversation = await tx.conversation.create({
        data: {
          status: "pending",
          members: {
            create: [{ userId: session.user.id }, { userId: recipientId }],
          },
        },
      });

      await tx.message.create({
        data: {
          conversationId: conversation.id,
          senderId: session.user.id,
          body: sanitizedBody,
        },
      });

      return { conversationId: conversation.id };
    });

    await trackEvent("conversation_started", session.user.id, { recipientId, conversationId });

    return NextResponse.json({ conversationId }, { status: 201 });
  }
  ```

- [ ] **Step 3: Run the message-requests tests**

  ```bash
  cd app && pnpm test src/__tests__/message-requests.test.ts
  ```
  Expected: `POST /api/conversations` tests pass. `PATCH` and `GET` tests still fail.

- [ ] **Step 4: Commit**

  ```bash
  cd app && git add src/app/api/conversations/route.ts
  git commit -m "feat(api): POST /api/conversations creates pending conversation with first message"
  ```

---

### Task A4: Add accept/reject to `PATCH /api/conversations/[id]`

**Files:**
- Modify: `app/src/app/api/conversations/[id]/route.ts`

- [ ] **Step 1: Add accept/reject handler before the "Unknown action" return**

  In `app/src/app/api/conversations/[id]/route.ts`, inside the `PATCH` function, add before the final `return NextResponse.json({ error: "Unknown action" }, { status: 400 })`:

  ```typescript
  // Accept or reject a pending message request (recipient only)
  if (body.action === "accept" || body.action === "reject") {
    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (conversation.status !== "pending") {
      return NextResponse.json(
        { error: "Conversation is not pending" },
        { status: 400 }
      );
    }

    // Only the recipient (not the sender of the first message) may accept/reject
    const firstMessage = await db.message.findFirst({
      where: { conversationId: id },
      orderBy: { sentAt: "asc" },
      select: { senderId: true },
    });

    if (firstMessage?.senderId === session.user.id) {
      return NextResponse.json(
        { error: "Only the recipient can accept or reject a request" },
        { status: 403 }
      );
    }

    const newStatus = body.action === "accept" ? "active" : "rejected";
    await db.conversation.update({ where: { id }, data: { status: newStatus } });
    return NextResponse.json({ status: newStatus });
  }
  ```

- [ ] **Step 2: Run the message-requests tests**

  ```bash
  cd app && pnpm test src/__tests__/message-requests.test.ts
  ```
  Expected: `PATCH` tests pass. `GET /api/conversations` tests still fail.

- [ ] **Step 3: Commit**

  ```bash
  cd app && git add src/app/api/conversations/[id]/route.ts
  git commit -m "feat(api): PATCH /api/conversations/[id] supports accept/reject for pending requests"
  ```

---

### Task A5: Guard `POST /api/messages` against pending/rejected and blocks

**Files:**
- Modify: `app/src/app/api/messages/route.ts`

- [ ] **Step 1: Add pending and rejected guards after the existing closed check**

  In `app/src/app/api/messages/route.ts`, find the block that checks `conversation?.status === "closed"` and replace it with:

  ```typescript
  if (conversation?.status === "closed" || conversation?.status === "rejected") {
    return NextResponse.json(
      { error: "This conversation has been closed." },
      { status: 403 }
    );
  }

  if (conversation?.status === "pending") {
    return NextResponse.json(
      { error: "This conversation is awaiting acceptance." },
      { status: 403 }
    );
  }
  ```

- [ ] **Step 2: Add block guard after the membership check**

  After verifying membership but before the conversation status check, add:

  ```typescript
  // Check if either party has blocked the other
  const otherMember = await db.conversationMember.findFirst({
    where: { conversationId, userId: { not: session.user.id } },
    select: { userId: true },
  });

  if (otherMember) {
    const block = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: otherMember.userId },
          { blockerId: otherMember.userId, blockedId: session.user.id },
        ],
      },
    });
    if (block) {
      return NextResponse.json(
        { error: "Cannot send messages to this user." },
        { status: 403 }
      );
    }
  }
  ```

- [ ] **Step 3: Run all messaging and message-requests tests**

  ```bash
  cd app && pnpm test src/__tests__/messaging.test.ts src/__tests__/message-requests.test.ts
  ```
  Expected: All tests pass.

- [ ] **Step 4: Commit**

  ```bash
  cd app && git add src/app/api/messages/route.ts
  git commit -m "feat(api): block messaging in pending/rejected conversations and across user blocks"
  ```

---

### Task A6: UI — messages/page.tsx Requests tab

**Files:**
- Modify: `app/src/app/(dashboard)/messages/page.tsx`

- [ ] **Step 1: Remove the auto-create `useEffect` (the `?new=` flow no longer works without a body)**

  Delete the `useEffect` block that starts with `if (!newRecipientId) return;` (lines 49–63 in the current file). The new flow for starting a conversation will be handled inline on the dashboard — the match card's "Message" button should navigate to `/messages/[id]` only after creating the conversation via a modal with message body. For now, just remove the broken auto-create.

- [ ] **Step 2: Add tab state and fetch for requests**

  In `MessagesContent`, add:
  ```typescript
  const [tab, setTab] = useState<"messages" | "requests">("messages");
  const [requests, setRequests] = useState<ConversationPreview[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations?type=requests")
      .then((r) => r.json())
      .then((data) => {
        setRequests(Array.isArray(data) ? data : []);
        setRequestsLoading(false);
      });
  }, []);
  ```

- [ ] **Step 3: Add tab bar and requests list to the render**

  Replace the `<h1>Messages</h1>` and conversation list with:
  ```tsx
  <div className="max-w-2xl mx-auto">
    <div className="flex items-center justify-between mb-6">
      <h1 className="text-2xl font-bold">Messages</h1>
    </div>

    {/* Tab bar */}
    <div className="flex gap-1 border-b mb-4">
      <button
        onClick={() => setTab("messages")}
        className={cn(
          "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
          tab === "messages"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        Messages
      </button>
      <button
        onClick={() => setTab("requests")}
        className={cn(
          "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
          tab === "requests"
            ? "border-primary text-foreground"
            : "border-transparent text-muted-foreground hover:text-foreground"
        )}
      >
        Requests
        {requests.length > 0 && (
          <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
            {requests.length}
          </span>
        )}
      </button>
    </div>

    {/* Content */}
    {tab === "messages" ? (
      /* Keep the existing JSX from this file verbatim: the `conversations.length === 0`
         EmptyState branch and the `<div className="border rounded-lg divide-y">` map over
         `conversations` — no changes needed to that block. */
      conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start by messaging one of your top matches. Find peers working on the same challenges as you."
          action={
            <Link href="/dashboard">
              <button className="text-sm text-primary hover:underline">
                Browse your matches
              </button>
            </Link>
          }
        />
      ) : (
        <div className="border rounded-lg divide-y">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className={cn(
                "flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors",
                conv.hasUnread && "bg-accent/20",
                conv.muted && "opacity-60"
              )}
            >
              <UserAvatar name={conv.otherUser?.name ?? "?"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className={cn("text-sm truncate", conv.hasUnread ? "font-semibold" : "font-medium")}>
                    {conv.otherUser?.name ?? "Unknown"}
                  </span>
                  {conv.lastMessage && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(conv.lastMessage.sentAt)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">{conv.lastMessage.body}</p>
                )}
                {conv.otherUser?.status === "suspended" && (
                  <p className="text-xs text-destructive">Account suspended</p>
                )}
              </div>
              {conv.hasUnread && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )
    ) : (
      /* requests list */
      requestsLoading ? (
        <ConversationListSkeleton />
      ) : requests.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="Message requests from other members will appear here."
        />
      ) : (
        <div className="border rounded-lg divide-y">
          {requests.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
            >
              <UserAvatar name={conv.otherUser?.name ?? "?"} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {conv.otherUser?.name ?? "Unknown"}
                </p>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage.body}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )
    )}
  </div>
  ```

- [ ] **Step 4: Commit**

  ```bash
  cd app && git add src/app/(dashboard)/messages/page.tsx
  git commit -m "feat(ui): messages page Requests tab with pending count badge"
  ```

---

### Task A7: UI — conversation page (pending state, accept/decline, block, report message)

**Files:**
- Modify: `app/src/app/(dashboard)/messages/[id]/page.tsx`

- [ ] **Step 1: Add `isPending` and `isSender` computed values**

  After the existing `const isClosed = ...` line, add:
  ```typescript
  const isPending = conversationInfo?.status === "pending";
  // isSender: true if current user sent the first message (i.e., initiated the request)
  const isSender = messages.length > 0 && messages[0].sender.id === currentUserId;
  ```

- [ ] **Step 2: Add accept/decline handler functions**

  After the `handleMute` function, add:
  ```typescript
  async function handleAccept() {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      setConversationInfo((prev) => prev ? { ...prev, status: "active" } : prev);
    }
  }

  async function handleDecline() {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) {
      router.push("/messages");
    }
  }
  ```

- [ ] **Step 3: Add block handler function**

  After `handleDecline`, add:
  ```typescript
  async function handleBlock() {
    await fetch(`/api/users/${otherUser?.id}/block`, { method: "POST" });
    router.push("/messages");
  }
  ```

- [ ] **Step 4: Add report message state and handler**

  Add to state declarations:
  ```typescript
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitted, setReportSubmitted] = useState(false);
  ```

  Add handler after `handleBlock`:
  ```typescript
  async function handleReportMessage() {
    if (!reportingMessageId || !reportReason.trim()) return;
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: reportingMessageId, reason: reportReason }),
    });
    setReportSubmitted(true);
    setReportingMessageId(null);
    setReportReason("");
  }
  ```

- [ ] **Step 5: Add "Block user" to the header dropdown**

  Inside the `DropdownMenuContent`, after the existing "Report conversation" `Dialog`, add:
  ```tsx
  <DropdownMenuItem
    onClick={handleBlock}
    className="text-destructive focus:text-destructive"
  >
    Block {otherUser?.name ?? "user"}
  </DropdownMenuItem>
  ```

- [ ] **Step 6: Add "Report message" to each message bubble**

  Wrap each message bubble `<div>` in a relative container and add a report button. Replace the outer `<div key={msg.id} className={cn("flex", ...)}>` with:
  ```tsx
  <div
    key={msg.id}
    className={cn("flex group", isMine ? "justify-end" : "justify-start")}
  >
    <div className="flex items-end gap-1">
      {!isMine && (
        <button
          onClick={() => setReportingMessageId(msg.id)}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-muted-foreground hover:text-destructive"
          aria-label="Report message"
          title="Report message"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>
        </button>
      )}
      <div className={cn("max-w-[75%] px-3 py-2 rounded-lg", isMine ? "bg-primary text-primary-foreground" : "bg-muted")}>
        {/* existing message body and timestamp JSX */}
      </div>
    </div>
  </div>
  ```

- [ ] **Step 7: Add Report message Dialog**

  Add a Dialog component (not inside a dropdown, controlled by `reportingMessageId` state) before the closing `</div>` of the page:
  ```tsx
  {reportingMessageId && (
    <Dialog open onOpenChange={(open) => !open && setReportingMessageId(null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report message</DialogTitle>
          <DialogDescription>
            Tell us what&apos;s wrong. Our team will review within 24 hours.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reportReason}
          onChange={(e) => setReportReason(e.target.value)}
          placeholder="Describe the issue..."
          maxLength={500}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setReportingMessageId(null)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleReportMessage}
            disabled={!reportReason.trim()}
          >
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )}
  ```

- [ ] **Step 8: Update the input area to handle pending state**

  Replace the current three-branch conditional (suspended / closed / textarea) with four branches:
  ```tsx
  {isSuspended ? (
    <div className="py-3 px-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
      This user&apos;s account has been suspended.
    </div>
  ) : isClosed ? (
    <div className="py-3 px-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
      This conversation has been closed.
    </div>
  ) : isPending && isSender ? (
    <div className="py-3 px-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
      Waiting for {otherUser?.name ?? "them"} to accept your request.
    </div>
  ) : isPending && !isSender ? (
    <div className="flex gap-2 pt-4 border-t">
      <Button variant="outline" onClick={handleDecline} className="flex-1">
        Decline
      </Button>
      <Button onClick={handleAccept} className="flex-1">
        Accept
      </Button>
    </div>
  ) : (
    /* existing textarea + send button JSX — unchanged */
  )}
  ```

- [ ] **Step 9: Commit**

  ```bash
  cd app && git add src/app/(dashboard)/messages/[id]/page.tsx
  git commit -m "feat(ui): conversation view pending state, accept/decline, block user, report message"
  ```

---

## Track B: User Blocking (New Files)

> Depends on Phase 0 (Tasks 1–3) completing first. Independent of Track A and C.

### Task B1: Write tests for blocking

**Files:**
- New: `app/src/__tests__/blocking.test.ts`

- [ ] **Step 1: Write the test file**

  Create `app/src/__tests__/blocking.test.ts`:
  ```typescript
  /**
   * Integration Tests: User Blocking
   * - POST /api/users/[id]/block creates block + closes active/pending conversation
   * - POST /api/users/[id]/block is idempotent
   * - DELETE /api/users/[id]/block removes block
   * - GET /api/users/[id]/block returns blocked status
   */
  import { describe, it, expect, beforeEach, vi } from "vitest";
  import { resetStores, stores } from "./mock-db";
  import {
    createRequest,
    parseResponse,
    seedOnboardedUser,
    seedConversation,
    seedPendingConversation,
    seedBlock,
  } from "./helpers";

  const mockAuth = vi.fn();
  vi.mock("@/lib/auth", () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
  }));

  import {
    POST as blockUserHandler,
    DELETE as unblockUserHandler,
    GET as checkBlockHandler,
  } from "@/app/api/users/[id]/block/route";

  function setSession(userId: string) {
    mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
  }

  function makeParams(id: string) {
    return Promise.resolve({ id });
  }

  describe("User Blocking", () => {
    beforeEach(() => {
      resetStores();
      vi.clearAllMocks();
    });

    describe("POST /api/users/[id]/block", () => {
      it("creates a UserBlock record", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`, { method: "POST" });
        const res = await blockUserHandler(req, { params: makeParams(userB.id) });

        expect(res.status).toBe(201);
        expect(stores.userBlocks.size).toBe(1);
        const block = [...stores.userBlocks.values()][0];
        expect(block.blockerId).toBe(userA.id);
        expect(block.blockedId).toBe(userB.id);
      });

      it("closes an active conversation between the two users", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedConversation(userA.id, userB.id);
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`, { method: "POST" });
        await blockUserHandler(req, { params: makeParams(userB.id) });

        expect(stores.conversations.get(conversationId)!.status).toBe("closed");
      });

      it("closes a pending conversation between the two users", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedPendingConversation(userA.id, userB.id, "Hello!");
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`, { method: "POST" });
        await blockUserHandler(req, { params: makeParams(userB.id) });

        expect(stores.conversations.get(conversationId)!.status).toBe("closed");
      });

      it("is idempotent when user is already blocked", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedBlock(userA.id, userB.id);
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`, { method: "POST" });
        const res = await blockUserHandler(req, { params: makeParams(userB.id) });

        expect(res.status).toBe(200);
        expect(stores.userBlocks.size).toBe(1);
      });

      it("returns 400 when trying to block yourself", async () => {
        const userA = await seedOnboardedUser();
        setSession(userA.id);

        const req = createRequest(`/api/users/${userA.id}/block`, { method: "POST" });
        const res = await blockUserHandler(req, { params: makeParams(userA.id) });

        expect(res.status).toBe(400);
      });
    });

    describe("DELETE /api/users/[id]/block", () => {
      it("removes the block", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedBlock(userA.id, userB.id);
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`, { method: "DELETE" });
        const res = await unblockUserHandler(req, { params: makeParams(userB.id) });

        expect(res.status).toBe(200);
        expect(stores.userBlocks.size).toBe(0);
      });

      it("returns 200 even when no block exists (idempotent)", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`, { method: "DELETE" });
        const res = await unblockUserHandler(req, { params: makeParams(userB.id) });

        expect(res.status).toBe(200);
      });
    });

    describe("GET /api/users/[id]/block", () => {
      it("returns blocked: true when block exists", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        seedBlock(userA.id, userB.id);
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`);
        const res = await checkBlockHandler(req, { params: makeParams(userB.id) });
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.blocked).toBe(true);
      });

      it("returns blocked: false when no block exists", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        setSession(userA.id);

        const req = createRequest(`/api/users/${userB.id}/block`);
        const res = await checkBlockHandler(req, { params: makeParams(userB.id) });
        const data = await parseResponse(res);

        expect(data.blocked).toBe(false);
      });
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they all fail**

  ```bash
  cd app && pnpm test src/__tests__/blocking.test.ts
  ```
  Expected: All fail — route does not exist yet.

---

### Task B2: Create the blocking route

**Files:**
- New: `app/src/app/api/users/[id]/block/route.ts`

- [ ] **Step 1: Create the directory and route file**

  Create `app/src/app/api/users/[id]/block/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";

  export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id: targetId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (targetId === session.user.id) {
      return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
    }

    // Idempotent: return 200 if already blocked
    const existing = await db.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
    });
    if (existing) {
      return NextResponse.json({ blocked: true }, { status: 200 });
    }

    await db.$transaction(async (tx) => {
      await tx.userBlock.create({
        data: { blockerId: session.user.id, blockedId: targetId },
      });

      // Close any active or pending shared conversation
      const membership = await tx.conversationMember.findFirst({
        where: {
          userId: session.user.id,
          conversation: { members: { some: { userId: targetId } } },
        },
        include: { conversation: { select: { id: true, status: true } } },
      });

      if (
        membership?.conversation &&
        (membership.conversation.status === "active" ||
          membership.conversation.status === "pending")
      ) {
        await tx.conversation.update({
          where: { id: membership.conversation.id },
          data: { status: "closed" },
        });
      }
    });

    return NextResponse.json({ blocked: true }, { status: 201 });
  }

  export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id: targetId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Idempotent: no-op if block doesn't exist
    const existing = await db.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
    });
    if (existing) {
      await db.userBlock.delete({
        where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
      });
    }

    return NextResponse.json({ blocked: false });
  }

  export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id: targetId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const block = await db.userBlock.findUnique({
      where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
    });

    return NextResponse.json({ blocked: !!block });
  }
  ```

- [ ] **Step 2: Run the blocking tests**

  ```bash
  cd app && pnpm test src/__tests__/blocking.test.ts
  ```
  Expected: All tests pass.

- [ ] **Step 3: Run all tests to check for regressions**

  ```bash
  cd app && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Step 4: Commit**

  ```bash
  cd app && git add src/app/api/users/[id]/block/route.ts src/__tests__/blocking.test.ts
  git commit -m "feat(api): POST/DELETE/GET /api/users/[id]/block — block, unblock, check"
  ```

---

## Track C: Reporting (New Files)

> Depends on Phase 0 (Tasks 1–3) completing first. Independent of Tracks A and B.

### Task C1: Write tests for reporting

**Files:**
- New: `app/src/__tests__/reporting.test.ts`

- [ ] **Step 1: Write the test file**

  Create `app/src/__tests__/reporting.test.ts`:
  ```typescript
  /**
   * Integration Tests: Reporting
   * - POST /api/reports creates report for a message
   * - POST /api/reports 400 when reason missing
   * - POST /api/reports 403 when reporter not member of conversation
   * - POST /api/reports 400 when reporting own message
   * - GET /api/admin/reports returns reports for admin
   * - GET /api/admin/reports 403 for non-admin
   * - PATCH /api/admin/reports/[id] dismiss → status dismissed
   * - PATCH /api/admin/reports/[id] suspend → user suspended, report actioned
   * - PATCH /api/admin/reports/[id] 403 for non-admin
   */
  import { describe, it, expect, beforeEach, vi } from "vitest";
  import { resetStores, stores } from "./mock-db";
  import {
    createRequest,
    parseResponse,
    seedOnboardedUser,
    seedAdmin,
    seedConversation,
    seedMessage,
    seedReport,
  } from "./helpers";

  const mockAuth = vi.fn();
  vi.mock("@/lib/auth", () => ({
    auth: (...args: unknown[]) => mockAuth(...args),
    signIn: vi.fn(),
    signOut: vi.fn(),
    handlers: { GET: vi.fn(), POST: vi.fn() },
  }));

  import { POST as createReportHandler } from "@/app/api/reports/route";
  import { GET as adminReportsListHandler } from "@/app/api/admin/reports/route";
  import { PATCH as adminReportActionHandler } from "@/app/api/admin/reports/[id]/route";

  function setSession(userId: string) {
    mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
  }

  function makeParams(id: string) {
    return Promise.resolve({ id });
  }

  describe("Reporting", () => {
    beforeEach(() => {
      resetStores();
      vi.clearAllMocks();
    });

    describe("POST /api/reports", () => {
      it("creates a pending report for a message", async () => {
        const reporter = await seedOnboardedUser();
        const reported = await seedOnboardedUser();
        const { conversationId } = seedConversation(reporter.id, reported.id);
        const messageId = seedMessage(conversationId, reported.id, "Inappropriate content");
        setSession(reporter.id);

        const req = createRequest("/api/reports", {
          method: "POST",
          body: { messageId, reason: "This is harassment." },
        });

        const res = await createReportHandler(req);

        expect(res.status).toBe(201);
        expect(stores.reports.size).toBe(1);
        const report = [...stores.reports.values()][0];
        expect(report.reporterId).toBe(reporter.id);
        expect(report.reportedUserId).toBe(reported.id);
        expect(report.messageId).toBe(messageId);
        expect(report.status).toBe("pending");
      });

      it("returns 400 when reason is missing", async () => {
        const reporter = await seedOnboardedUser();
        const reported = await seedOnboardedUser();
        const { conversationId } = seedConversation(reporter.id, reported.id);
        const messageId = seedMessage(conversationId, reported.id, "Bad message");
        setSession(reporter.id);

        const req = createRequest("/api/reports", {
          method: "POST",
          body: { messageId },
        });

        const res = await createReportHandler(req);
        expect(res.status).toBe(400);
      });

      it("returns 403 when reporter is not a member of the conversation", async () => {
        const reporter = await seedOnboardedUser();
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedConversation(userA.id, userB.id);
        const messageId = seedMessage(conversationId, userB.id, "Some message");
        setSession(reporter.id);

        const req = createRequest("/api/reports", {
          method: "POST",
          body: { messageId, reason: "Reporting from outside" },
        });

        const res = await createReportHandler(req);
        expect(res.status).toBe(403);
      });

      it("returns 400 when reporter tries to report their own message", async () => {
        const userA = await seedOnboardedUser();
        const userB = await seedOnboardedUser();
        const { conversationId } = seedConversation(userA.id, userB.id);
        const messageId = seedMessage(conversationId, userA.id, "My own message");
        setSession(userA.id);

        const req = createRequest("/api/reports", {
          method: "POST",
          body: { messageId, reason: "Reporting myself" },
        });

        const res = await createReportHandler(req);
        expect(res.status).toBe(400);
      });
    });

    describe("GET /api/admin/reports", () => {
      it("returns all reports for admin", async () => {
        const admin = await seedAdmin();
        const reporter = await seedOnboardedUser();
        const reported = await seedOnboardedUser();
        const { conversationId } = seedConversation(reporter.id, reported.id);
        const messageId = seedMessage(conversationId, reported.id, "Bad content");
        seedReport(reporter.id, reported.id, messageId);
        setSession(admin.id);

        const req = createRequest("/api/admin/reports");
        const res = await adminReportsListHandler(req);
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.length).toBe(1);
        expect(data[0].status).toBe("pending");
      });

      it("returns 403 for non-admin", async () => {
        const user = await seedOnboardedUser();
        setSession(user.id);

        const req = createRequest("/api/admin/reports");
        const res = await adminReportsListHandler(req);
        expect(res.status).toBe(403);
      });
    });

    describe("PATCH /api/admin/reports/[id]", () => {
      it("dismiss sets report status to dismissed", async () => {
        const admin = await seedAdmin();
        const reporter = await seedOnboardedUser();
        const reported = await seedOnboardedUser();
        const { conversationId } = seedConversation(reporter.id, reported.id);
        const messageId = seedMessage(conversationId, reported.id, "Content");
        const reportId = seedReport(reporter.id, reported.id, messageId);
        setSession(admin.id);

        const req = createRequest(`/api/admin/reports/${reportId}`, {
          method: "PATCH",
          body: { action: "dismiss" },
        });

        const res = await adminReportActionHandler(req, { params: makeParams(reportId) });
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.status).toBe("dismissed");
        expect(stores.reports.get(reportId)!.status).toBe("dismissed");
      });

      it("suspend suspends the reported user and marks report as actioned", async () => {
        const admin = await seedAdmin();
        const reporter = await seedOnboardedUser();
        const reported = await seedOnboardedUser();
        const { conversationId } = seedConversation(reporter.id, reported.id);
        const messageId = seedMessage(conversationId, reported.id, "Content");
        const reportId = seedReport(reporter.id, reported.id, messageId);
        setSession(admin.id);

        const req = createRequest(`/api/admin/reports/${reportId}`, {
          method: "PATCH",
          body: { action: "suspend" },
        });

        const res = await adminReportActionHandler(req, { params: makeParams(reportId) });
        const data = await parseResponse(res);

        expect(res.status).toBe(200);
        expect(data.status).toBe("actioned");
        expect(stores.users.get(reported.id)!.status).toBe("suspended");
      });

      it("returns 403 for non-admin", async () => {
        const user = await seedOnboardedUser();
        const reporter = await seedOnboardedUser();
        const reported = await seedOnboardedUser();
        const { conversationId } = seedConversation(reporter.id, reported.id);
        const messageId = seedMessage(conversationId, reported.id, "Content");
        const reportId = seedReport(reporter.id, reported.id, messageId);
        setSession(user.id);

        const req = createRequest(`/api/admin/reports/${reportId}`, {
          method: "PATCH",
          body: { action: "dismiss" },
        });

        const res = await adminReportActionHandler(req, { params: makeParams(reportId) });
        expect(res.status).toBe(403);
      });
    });
  });
  ```

- [ ] **Step 2: Run tests to confirm they all fail**

  ```bash
  cd app && pnpm test src/__tests__/reporting.test.ts
  ```
  Expected: All fail — routes do not exist yet.

---

### Task C2: Create `POST /api/reports`

**Files:**
- New: `app/src/app/api/reports/route.ts`

- [ ] **Step 1: Create the file**

  Create `app/src/app/api/reports/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";
  import { z } from "zod/v4";

  const reportSchema = z.object({
    messageId: z.string().min(1),
    reason: z.string().min(1).max(500),
  });

  export async function POST(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = reportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const { messageId, reason } = parsed.data;

    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { id: true, senderId: true, conversationId: true },
    });

    if (!message) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (message.senderId === session.user.id) {
      return NextResponse.json({ error: "Cannot report your own message" }, { status: 400 });
    }

    // Reporter must be a member of the conversation
    const membership = await db.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId: message.conversationId,
          userId: session.user.id,
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db.report.create({
      data: {
        reporterId: session.user.id,
        reportedUserId: message.senderId,
        messageId,
        reason: reason.trim(),
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  }
  ```

- [ ] **Step 2: Run the reporting tests (partial)**

  ```bash
  cd app && pnpm test src/__tests__/reporting.test.ts
  ```
  Expected: `POST /api/reports` tests pass. Admin tests still fail.

- [ ] **Step 3: Commit**

  ```bash
  cd app && git add src/app/api/reports/route.ts
  git commit -m "feat(api): POST /api/reports — file a per-message report"
  ```

---

### Task C3: Create admin reports API routes

**Files:**
- New: `app/src/app/api/admin/reports/route.ts`
- New: `app/src/app/api/admin/reports/[id]/route.ts`

- [ ] **Step 1: Create `GET /api/admin/reports`**

  Create `app/src/app/api/admin/reports/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";

  export async function GET(request: NextRequest) {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!user?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const statusFilter = request.nextUrl.searchParams.get("status") ?? "pending";

    const reports = await db.report.findMany({
      where: { status: statusFilter },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with conversationId for linking to conversation context
    const enriched = await Promise.all(
      reports.map(async (r) => {
        const message = await db.message.findUnique({
          where: { id: r.messageId },
          select: { conversationId: true, body: true },
        });
        return { ...r, conversationId: message?.conversationId ?? null, messageBody: message?.body ?? null };
      })
    );

    return NextResponse.json(enriched);
  }
  ```

- [ ] **Step 2: Create `PATCH /api/admin/reports/[id]`**

  Create `app/src/app/api/admin/reports/[id]/route.ts`:
  ```typescript
  import { NextRequest, NextResponse } from "next/server";
  import { auth } from "@/lib/auth";
  import { db } from "@/lib/db";

  export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
  ) {
    const { id } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const admin = await db.user.findUnique({
      where: { id: session.user.id },
      select: { isAdmin: true },
    });
    if (!admin?.isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    if (action !== "dismiss" && action !== "suspend") {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    const report = await db.report.findUnique({ where: { id } });
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (action === "dismiss") {
      await db.report.update({
        where: { id },
        data: {
          status: "dismissed",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
      return NextResponse.json({ status: "dismissed" });
    }

    // suspend
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: report.reportedUserId },
        data: { status: "suspended" },
      });
      await tx.report.update({
        where: { id },
        data: {
          status: "actioned",
          reviewedById: session.user.id,
          reviewedAt: new Date(),
        },
      });
    });

    return NextResponse.json({ status: "actioned" });
  }
  ```

- [ ] **Step 3: Run all reporting tests**

  ```bash
  cd app && pnpm test src/__tests__/reporting.test.ts
  ```
  Expected: All tests pass.

- [ ] **Step 4: Run all tests**

  ```bash
  cd app && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Step 5: Commit**

  ```bash
  cd app && git add src/app/api/admin/reports/ src/__tests__/reporting.test.ts
  git commit -m "feat(api): admin reports endpoints — list, dismiss, suspend"
  ```

---

### Task C4: Create admin reports UI page

**Files:**
- New: `app/src/app/admin/reports/page.tsx`

- [ ] **Step 1: Create the page**

  Create `app/src/app/admin/reports/page.tsx`:
  ```tsx
  "use client";

  import { useState, useEffect } from "react";
  import Link from "next/link";
  import { Badge } from "@/components/ui/badge";
  import { Button } from "@/components/ui/button";
  import { EmptyState } from "@/components/empty-state";

  interface Report {
    id: string;
    reporterId: string;
    reportedUserId: string;
    messageId: string;
    messageBody: string | null;
    conversationId: string | null;
    reason: string;
    status: string;
    createdAt: string;
  }

  export default function AdminReportsPage() {
    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState<string | null>(null);

    useEffect(() => {
      fetch("/api/admin/reports?status=pending")
        .then((r) => r.json())
        .then((data) => {
          setReports(Array.isArray(data) ? data : []);
          setLoading(false);
        });
    }, []);

    async function handleAction(reportId: string, action: "dismiss" | "suspend") {
      setActing(reportId);
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== reportId));
      }
      setActing(null);
    }

    if (!loading && reports.length === 0) {
      return (
        <div>
          <h1 className="text-2xl font-bold mb-6">Reports</h1>
          <EmptyState
            title="No pending reports"
            description="User reports will appear here for review."
          />
        </div>
      );
    }

    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Reports</h1>
        <div className="border rounded-lg divide-y">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-4">
                  <div className="h-4 w-64 bg-muted rounded animate-pulse" />
                </div>
              ))
            : reports.map((report) => (
                <div key={report.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline">Report</Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    {report.messageBody && (
                      <p className="text-xs text-muted-foreground mt-1 italic truncate">
                        &ldquo;{report.messageBody}&rdquo;
                      </p>
                    )}
                    <p className="text-sm mt-1">{report.reason}</p>
                    {report.conversationId && (
                      <Link
                        href={`/admin/flagged/${report.conversationId}`}
                        className="text-xs text-primary hover:underline mt-1 inline-block"
                      >
                        View conversation context →
                      </Link>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAction(report.id, "dismiss")}
                      disabled={acting === report.id}
                    >
                      Dismiss
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleAction(report.id, "suspend")}
                      disabled={acting === report.id}
                    >
                      Suspend user
                    </Button>
                  </div>
                </div>
              ))}
        </div>
      </div>
    );
  }
  ```

- [ ] **Step 2: Commit**

  ```bash
  cd app && git add src/app/admin/reports/page.tsx
  git commit -m "feat(ui): admin reports page with dismiss/suspend actions"
  ```

---

### Task C5: Add Reports link to admin nav

**Files:**
- Modify: `app/src/app/admin/layout.tsx`

- [ ] **Step 1: Add Reports to the `ADMIN_NAV` array**

  In `app/src/app/admin/layout.tsx`, replace:
  ```typescript
  const ADMIN_NAV = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/flagged", label: "Flagged" },
    { href: "/admin/keywords", label: "Keywords" },
    { href: "/admin/problems", label: "Problems" },
  ];
  ```
  With:
  ```typescript
  const ADMIN_NAV = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/flagged", label: "Flagged" },
    { href: "/admin/reports", label: "Reports" },
    { href: "/admin/keywords", label: "Keywords" },
    { href: "/admin/problems", label: "Problems" },
  ];
  ```

- [ ] **Step 2: Run lint**

  ```bash
  cd app && pnpm lint
  ```
  Expected: No errors.

- [ ] **Step 3: Commit**

  ```bash
  cd app && git add src/app/admin/layout.tsx
  git commit -m "feat(ui): add Reports link to admin nav"
  ```

---

## Final Verification

After all tracks are merged:

- [ ] **Run all tests**

  ```bash
  cd app && pnpm test
  ```
  Expected: All tests pass.

- [ ] **Run lint**

  ```bash
  cd app && pnpm lint
  ```
  Expected: No errors.

- [ ] **Start dev server and smoke test manually**

  ```bash
  cd app && make run
  ```
  Verify:
  - Clicking "Message" on a match card requires a message body before conversation is created
  - Recipient sees Requests tab with pending request
  - Accept/decline work and update conversation state
  - Block user closes conversation and redirects
  - Report message modal appears on hover, submits successfully
  - Admin `/reports` page shows pending reports with dismiss/suspend actions
