/**
 * E2E Integration Tests: Admin & Moderation
 * Based on PRD Section 3 (Flow 4), Section 4.F
 *
 * Tests:
 * - Admin stats endpoint
 * - Admin user list with search/filter
 * - Suspend/unsuspend user
 * - Flagged conversations list
 * - Flagged conversation detail (full thread)
 * - Admin moderation actions (resolve, close, suspend user, delete message)
 * - Keyword alert CRUD
 * - Problem statement CRUD
 * - Admin route protection (non-admin blocked)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStores, stores } from "./mock-db";
import {
  createRequest,
  parseResponse,
  seedAdmin,
  seedOnboardedUser,
  seedConversation,
  seedMessage,
  seedProblemStatements,
  seedKeyword,
} from "./helpers";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { GET as statsHandler } from "@/app/api/admin/stats/route";
import { GET as usersListHandler, PATCH as usersPatchHandler } from "@/app/api/admin/users/route";
import { GET as flaggedListHandler } from "@/app/api/admin/flagged/route";
import { GET as flaggedDetailHandler, PATCH as flaggedActionHandler } from "@/app/api/admin/flagged/[id]/route";
import { GET as keywordsListHandler, POST as keywordsCreateHandler, DELETE as keywordsDeleteHandler } from "@/app/api/admin/keywords/route";
import { GET as adminProblemsListHandler, POST as adminProblemsCreateHandler } from "@/app/api/admin/problems/route";
import { PATCH as adminProblemsPatchHandler } from "@/app/api/admin/problems/[id]/route";

function setAdminSession(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId, name: "Admin", email: "admin@t.com" } });
}

function setUserSession(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId, name: "User", email: "user@t.com" } });
}

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("Admin & Moderation", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  // ─── Route Protection ───────────────────────────────────────────────

  describe("Admin route protection", () => {
    it("blocks non-admin from stats endpoint", async () => {
      const user = await seedOnboardedUser();
      setUserSession(user.id);

      const res = await statsHandler();
      expect(res.status).toBe(403);
    });

    it("blocks unauthenticated from stats endpoint", async () => {
      mockAuth.mockResolvedValue(null);

      const res = await statsHandler();
      expect(res.status).toBe(401);
    });

    it("blocks non-admin from users endpoint", async () => {
      const user = await seedOnboardedUser();
      setUserSession(user.id);

      const req = createRequest("/api/admin/users");
      const res = await usersListHandler(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── Stats ──────────────────────────────────────────────────────────

  describe("GET /api/admin/stats", () => {
    it("returns platform statistics", async () => {
      const admin = await seedAdmin();
      await seedOnboardedUser();
      await seedOnboardedUser();
      setAdminSession(admin.id);

      const res = await statsHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.totalUsers).toBeDefined();
      expect(data.activeUsers).toBeDefined();
      expect(data.messagesThisWeek).toBeDefined();
      expect(data.flaggedConversations).toBeDefined();
    });
  });

  // ─── User Management ───────────────────────────────────────────────

  describe("GET /api/admin/users", () => {
    it("lists users with pagination", async () => {
      const admin = await seedAdmin();
      await seedOnboardedUser({ name: "Alice" });
      await seedOnboardedUser({ name: "Bob" });
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/users?page=1");
      const res = await usersListHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.users.length).toBeGreaterThanOrEqual(2);
      expect(data.total).toBeDefined();
    });

    it("searches users by name", async () => {
      const admin = await seedAdmin();
      await seedOnboardedUser({ name: "Alice Johnson" });
      await seedOnboardedUser({ name: "Bob Smith" });
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/users?search=Alice");
      const res = await usersListHandler(req);
      const data = await parseResponse(res);

      expect(data.users.some((u: { name: string }) => u.name.includes("Alice"))).toBe(true);
    });
  });

  describe("PATCH /api/admin/users (suspend/unsuspend)", () => {
    it("suspends a user", async () => {
      const admin = await seedAdmin();
      const user = await seedOnboardedUser({ name: "Bad Actor" });
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/users", {
        method: "PATCH",
        body: { userId: user.id, action: "suspend" },
      });

      const res = await usersPatchHandler(req);
      expect(res.status).toBe(200);

      const updated = stores.users.get(user.id)!;
      expect(updated.status).toBe("suspended");
    });

    it("unsuspends a user", async () => {
      const admin = await seedAdmin();
      const user = await seedOnboardedUser({ status: "suspended" });
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/users", {
        method: "PATCH",
        body: { userId: user.id, action: "unsuspend" },
      });

      const res = await usersPatchHandler(req);
      expect(res.status).toBe(200);

      const updated = stores.users.get(user.id)!;
      expect(updated.status).toBe("active");
    });
  });

  // ─── Flagged Conversations ──────────────────────────────────────────

  describe("GET /api/admin/flagged", () => {
    it("lists flagged conversations", async () => {
      const admin = await seedAdmin();
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      stores.conversations.get(conversationId)!.status = "flagged";
      setAdminSession(admin.id);

      const res = await flaggedListHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].status).toBe("flagged");
    });
  });

  describe("GET /api/admin/flagged/[id]", () => {
    it("returns full message thread for flagged conversation", async () => {
      const admin = await seedAdmin();
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      stores.conversations.get(conversationId)!.status = "flagged";
      seedMessage(conversationId, userA.id, "Hello");
      seedMessage(conversationId, userB.id, "Hi");
      setAdminSession(admin.id);

      const req = createRequest(`/api/admin/flagged/${conversationId}`);
      const res = await flaggedDetailHandler(req, { params: makeParams(conversationId) });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.messages).toBeDefined();
    });
  });

  describe("PATCH /api/admin/flagged/[id] (moderation actions)", () => {
    it("resolves flagged conversation", async () => {
      const admin = await seedAdmin();
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      stores.conversations.get(conversationId)!.status = "flagged";
      setAdminSession(admin.id);

      const req = createRequest(`/api/admin/flagged/${conversationId}`, {
        method: "PATCH",
        body: { action: "resolve" },
      });

      const res = await flaggedActionHandler(req, { params: makeParams(conversationId) });
      expect(res.status).toBe(200);

      const conv = stores.conversations.get(conversationId)!;
      expect(conv.status).toBe("active");
    });

    it("closes flagged conversation", async () => {
      const admin = await seedAdmin();
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      stores.conversations.get(conversationId)!.status = "flagged";
      setAdminSession(admin.id);

      const req = createRequest(`/api/admin/flagged/${conversationId}`, {
        method: "PATCH",
        body: { action: "close" },
      });

      await flaggedActionHandler(req, { params: makeParams(conversationId) });

      const conv = stores.conversations.get(conversationId)!;
      expect(conv.status).toBe("closed");
    });

    it("soft-deletes a message (audit trail preserved)", async () => {
      const admin = await seedAdmin();
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      const msgId = seedMessage(conversationId, userA.id, "Bad message");
      setAdminSession(admin.id);

      const req = createRequest(`/api/admin/flagged/${conversationId}`, {
        method: "PATCH",
        body: { action: "delete_message", messageId: msgId },
      });

      await flaggedActionHandler(req, { params: makeParams(conversationId) });

      const msg = stores.messages.get(msgId)!;
      expect(msg.deletedAt).toBeDefined();
      expect(msg.deletedAt).not.toBeNull();
      // Message still exists (soft delete), not removed from store
      expect(stores.messages.has(msgId)).toBe(true);
    });
  });

  // ─── Keyword Alerts ─────────────────────────────────────────────────

  describe("Keyword Alert CRUD", () => {
    it("creates a keyword alert", async () => {
      const admin = await seedAdmin();
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/keywords", {
        method: "POST",
        body: { keyword: "spam" },
      });

      const res = await keywordsCreateHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.keyword).toBe("spam");
    });

    it("lists keyword alerts", async () => {
      const admin = await seedAdmin();
      seedKeyword("badword");
      seedKeyword("spam");
      setAdminSession(admin.id);

      const res = await keywordsListHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.length).toBe(2);
    });

    it("deletes a keyword alert", async () => {
      const admin = await seedAdmin();
      const kwId = seedKeyword("removeme");
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/keywords", {
        method: "DELETE",
        body: { id: kwId },
      });

      const res = await keywordsDeleteHandler(req);
      expect(res.status).toBe(200);
      expect(stores.keywordAlerts.has(kwId)).toBe(false);
    });
  });

  // ─── Problem Statement CRUD ─────────────────────────────────────────

  describe("Problem Statement CRUD", () => {
    it("lists problem statements with user count", async () => {
      const admin = await seedAdmin();
      seedProblemStatements();
      setAdminSession(admin.id);

      const res = await adminProblemsListHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(5);
    });

    it("creates a new problem statement", async () => {
      const admin = await seedAdmin();
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/problems", {
        method: "POST",
        body: {
          label: "New challenge: AI in literacy",
          category: "Emerging Topics",
          sortOrder: 21,
        },
      });

      const res = await adminProblemsCreateHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.label).toBe("New challenge: AI in literacy");
    });

    it("retires a problem statement (set active=false)", async () => {
      const admin = await seedAdmin();
      seedProblemStatements();
      setAdminSession(admin.id);

      const req = createRequest("/api/admin/problems/ps_1", {
        method: "PATCH",
        body: { active: false },
      });

      const res = await adminProblemsPatchHandler(req, { params: makeParams("ps_1") });
      expect(res.status).toBe(200);

      const ps = stores.problemStatements.get("ps_1")!;
      expect(ps.active).toBe(false);
    });
  });
});
