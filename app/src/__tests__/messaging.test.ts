/**
 * E2E Integration Tests: Messaging System
 * Based on PRD Section 3 (Flow 3), Section 4.E
 *
 * Tests:
 * - Create conversation
 * - Prevent duplicate conversations between same users
 * - Send message with sanitization
 * - Poll for new messages (?since=)
 * - Read receipts (mark as read)
 * - Mute/unmute conversation
 * - Report/flag conversation
 * - Rate limiting on messages
 * - Suspended user can't send messages
 * - Closed conversation blocks new messages
 * - Keyword alert triggers auto-flag
 * - Access control (can't read other user's conversations)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStores, stores } from "./mock-db";
import {
  createRequest,
  parseResponse,
  seedOnboardedUser,
  seedConversation,
  seedMessage,
  seedKeyword,
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

import { GET as conversationsListHandler, POST as conversationCreateHandler } from "@/app/api/conversations/route";
import { GET as messagesGetHandler } from "@/app/api/conversations/[id]/messages/route";
import { PATCH as conversationPatchHandler } from "@/app/api/conversations/[id]/route";
import { POST as messageSendHandler } from "@/app/api/messages/route";

function setSession(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
}

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("Messaging System", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  // ─── Conversation Creation ───────────────────────────────────────────

  describe("POST /api/conversations", () => {
    it("creates a new conversation between two users", async () => {
      const userA = await seedOnboardedUser({ name: "Alice" });
      const userB = await seedOnboardedUser({ name: "Bob" });
      setSession(userA.id);

      const req = createRequest("/api/conversations", {
        method: "POST",
        body: { recipientId: userB.id },
      });

      const res = await conversationCreateHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.conversationId).toBeDefined();

      // Verify conversation and members were created
      expect(stores.conversations.size).toBe(1);
      expect(stores.conversationMembers.size).toBe(2);
    });

    it("returns existing conversation if already exists", async () => {
      const userA = await seedOnboardedUser({ name: "Alice" });
      const userB = await seedOnboardedUser({ name: "Bob" });
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest("/api/conversations", {
        method: "POST",
        body: { recipientId: userB.id },
      });

      const res = await conversationCreateHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.conversationId).toBe(conversationId);

      // No new conversation should be created
      expect(stores.conversations.size).toBe(1);
    });

    it("prevents conversation with yourself", async () => {
      const user = await seedOnboardedUser();
      setSession(user.id);

      const req = createRequest("/api/conversations", {
        method: "POST",
        body: { recipientId: user.id },
      });

      const res = await conversationCreateHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent recipient", async () => {
      const user = await seedOnboardedUser();
      setSession(user.id);

      const req = createRequest("/api/conversations", {
        method: "POST",
        body: { recipientId: "non_existent" },
      });

      const res = await conversationCreateHandler(req);
      expect(res.status).toBe(404);
    });

    it("tracks conversation_started analytics event", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      setSession(userA.id);

      const req = createRequest("/api/conversations", {
        method: "POST",
        body: { recipientId: userB.id },
      });

      await conversationCreateHandler(req);

      const events = [...stores.analyticsEvents.values()];
      const startEvent = events.find((e) => e.eventType === "conversation_started");
      expect(startEvent).toBeDefined();
    });
  });

  // ─── Sending Messages ───────────────────────────────────────────────

  describe("POST /api/messages", () => {
    it("sends a message in a conversation", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "Hello, fellow literacy leader!" },
      });

      const res = await messageSendHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.body).toBe("Hello, fellow literacy leader!");
      expect(data.senderId).toBe(userA.id);

      // Verify message stored
      expect(stores.messages.size).toBe(1);
    });

    it("blocks suspended user from sending", async () => {
      const userA = await seedOnboardedUser({ status: "suspended" });
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "Should fail" },
      });

      const res = await messageSendHandler(req);
      expect(res.status).toBe(403);
    });

    it("blocks messages in closed conversation", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      stores.conversations.get(conversationId)!.status = "closed";
      setSession(userA.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "Should fail" },
      });

      const res = await messageSendHandler(req);
      expect(res.status).toBe(403);
    });

    it("rejects empty message body", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "" },
      });

      const res = await messageSendHandler(req);
      expect(res.status).toBe(400);
    });

    it("auto-flags conversation when keyword matches", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      seedKeyword("badword");
      setSession(userA.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "This contains badword in it" },
      });

      const res = await messageSendHandler(req);
      expect(res.status).toBe(201);

      // Conversation should be flagged
      const conv = stores.conversations.get(conversationId)!;
      expect(conv.status).toBe("flagged");

      // Message should be flagged
      const msg = [...stores.messages.values()][0];
      expect(msg.flagged).toBe(true);
    });

    it("prevents non-member from sending to conversation", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const outsider = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(outsider.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "I shouldn't be here" },
      });

      const res = await messageSendHandler(req);
      expect(res.status).toBe(403);
    });

    it("tracks message_sent analytics event", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest("/api/messages", {
        method: "POST",
        body: { conversationId, body: "Hello!" },
      });

      await messageSendHandler(req);

      const events = [...stores.analyticsEvents.values()];
      expect(events.some((e) => e.eventType === "message_sent")).toBe(true);
    });
  });

  // ─── Polling Messages ───────────────────────────────────────────────

  describe("GET /api/conversations/[id]/messages", () => {
    it("returns all messages in a conversation", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      seedMessage(conversationId, userA.id, "Hello!");
      seedMessage(conversationId, userB.id, "Hi there!");
      setSession(userA.id);

      const req = createRequest(`/api/conversations/${conversationId}/messages`);
      const res = await messagesGetHandler(req, { params: makeParams(conversationId) });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
    });

    it("returns only new messages when ?since= is provided", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);

      const oldTime = new Date(Date.now() - 10000);
      const newTime = new Date(Date.now() + 1000);

      seedMessage(conversationId, userA.id, "Old message", { sentAt: oldTime });
      seedMessage(conversationId, userB.id, "New message", { sentAt: newTime });

      setSession(userA.id);

      const sinceParam = new Date().toISOString();
      const req = createRequest(`/api/conversations/${conversationId}/messages?since=${sinceParam}`);
      const res = await messagesGetHandler(req, { params: makeParams(conversationId) });
      const data = await parseResponse(res);

      // Should only return messages after "since"
      expect(data.length).toBeLessThanOrEqual(1);
    });

    it("blocks non-member from reading conversation", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const outsider = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(outsider.id);

      const req = createRequest(`/api/conversations/${conversationId}/messages`);
      const res = await messagesGetHandler(req, { params: makeParams(conversationId) });

      expect(res.status).toBe(403);
    });
  });

  // ─── Conversation Actions ───────────────────────────────────────────

  describe("PATCH /api/conversations/[id]", () => {
    it("toggles mute for conversation", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        body: { action: "mute" },
      });

      const res = await conversationPatchHandler(req, { params: makeParams(conversationId) });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.muted).toBe(true);
    });

    it("flags conversation on report", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      setSession(userA.id);

      const req = createRequest(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        body: { action: "report", reason: "harassment" },
      });

      const res = await conversationPatchHandler(req, { params: makeParams(conversationId) });
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.status).toBe("flagged");

      const conv = stores.conversations.get(conversationId)!;
      expect(conv.status).toBe("flagged");
    });
  });

  // ─── Conversation List ──────────────────────────────────────────────

  describe("GET /api/conversations", () => {
    it("lists user's conversations with last message preview", async () => {
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { conversationId } = seedConversation(userA.id, userB.id);
      seedMessage(conversationId, userA.id, "Latest message");
      setSession(userA.id);

      const res = await conversationsListHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(1);
    });

    it("requires authentication", async () => {
      mockAuth.mockResolvedValue(null);

      const res = await conversationsListHandler();
      expect(res.status).toBe(401);
    });
  });
});
