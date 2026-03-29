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
