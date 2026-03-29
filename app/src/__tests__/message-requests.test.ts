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
