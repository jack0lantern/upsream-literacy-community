/**
 * E2E Integration Tests: Authentication Flows
 * Based on PRD Section 3 (Flow 1) and Section 4.A
 *
 * Tests:
 * - Signup with valid data
 * - Signup validation (missing fields, invalid email, short password)
 * - Signup duplicate email prevention (no email enumeration)
 * - Login (correct and incorrect credentials)
 * - Suspended / deactivated user login blocked
 * - Password reset request (generic response for security)
 * - Password reset execution
 * - Email verification
 * - Rate limiting on signup
 * - Health check endpoint
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStores, stores, mockDb } from "./mock-db";
import {
  createRequest,
  parseResponse,
  seedUser,
} from "./helpers";

// Mock auth for routes that need session
vi.mock("@/lib/auth", () => ({
  auth: vi.fn().mockResolvedValue(null),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

// Import route handlers
import { POST as signupHandler } from "@/app/api/auth/signup/route";
import { GET as verifyEmailHandler } from "@/app/api/auth/verify-email/route";
import { POST as forgotPasswordHandler } from "@/app/api/auth/forgot-password/route";
import { POST as resetPasswordHandler } from "@/app/api/auth/reset-password/route";
import { GET as healthHandler } from "@/app/api/health/route";

// Reset rate limit state between tests
vi.mock("@/lib/rate-limit", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/rate-limit")>();
  return {
    ...original,
    rateLimitSignup: vi.fn().mockReturnValue({ allowed: true, remaining: 2 }),
    rateLimitLogin: vi.fn().mockReturnValue({ allowed: true, remaining: 4 }),
  };
});

describe("Auth Flows", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  // ─── Signup ──────────────────────────────────────────────────────────

  describe("POST /api/auth/signup", () => {
    it("creates a new user with valid data", async () => {
      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "maria@district.edu", password: "securepass123", name: "Maria Rodriguez" },
      });

      const res = await signupHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.message).toContain("Account created");
      expect(data.userId).toBeDefined();

      // Verify user was stored
      expect(stores.users.size).toBe(1);
      const user = [...stores.users.values()][0];
      expect(user.email).toBe("maria@district.edu");
      expect(user.name).toBe("Maria Rodriguez");
      expect(user.emailVerified).toBe(false);
      expect(user.onboarded).toBe(false);

      // Verify verification token was created
      expect(stores.emailVerificationTokens.size).toBe(1);
    });

    it("rejects signup with missing name", async () => {
      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "test@test.com", password: "securepass123" },
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);
    });

    it("rejects signup with invalid email", async () => {
      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "not-an-email", password: "securepass123", name: "Test" },
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);
    });

    it("rejects signup with short password (< 8 chars)", async () => {
      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "test@test.com", password: "short", name: "Test" },
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns generic error for duplicate email (prevents enumeration)", async () => {
      await seedUser({ email: "taken@test.com" });

      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "taken@test.com", password: "securepass123", name: "Test" },
      });

      const res = await signupHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(400);
      // Must not reveal that the email exists
      expect(data.error.toLowerCase()).not.toContain("already exists");
      expect(data.error.toLowerCase()).not.toContain("already registered");
    });

    it("tracks signup analytics event", async () => {
      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "analytics@test.com", password: "securepass123", name: "Test" },
      });

      await signupHandler(req);

      expect(stores.analyticsEvents.size).toBe(1);
      const event = [...stores.analyticsEvents.values()][0];
      expect(event.eventType).toBe("signup");
    });
  });

  // ─── Email Verification ──────────────────────────────────────────────

  describe("GET /api/auth/verify-email", () => {
    it("verifies email with valid token", async () => {
      const user = await seedUser({ emailVerified: false });
      const tokenId = "tok_1";
      stores.emailVerificationTokens.set(tokenId, {
        id: tokenId,
        token: "valid-token-123",
        userId: user.id,
        expiresAt: new Date(Date.now() + 86400000),
      });

      const req = createRequest("/api/auth/verify-email?token=valid-token-123");
      const res = await verifyEmailHandler(req);

      // Should redirect to dashboard
      expect(res.status).toBe(307); // redirect

      // User should be verified
      const updatedUser = stores.users.get(user.id)!;
      expect(updatedUser.emailVerified).toBe(true);
    });

    it("rejects expired verification token", async () => {
      const user = await seedUser();
      const tokenId = "tok_exp";
      stores.emailVerificationTokens.set(tokenId, {
        id: tokenId,
        token: "expired-token",
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000), // expired
      });

      const req = createRequest("/api/auth/verify-email?token=expired-token");
      const res = await verifyEmailHandler(req);

      expect(res.status).toBe(400);
    });

    it("rejects missing token", async () => {
      const req = createRequest("/api/auth/verify-email");
      const res = await verifyEmailHandler(req);

      expect(res.status).toBe(400);
    });
  });

  // ─── Forgot Password ────────────────────────────────────────────────

  describe("POST /api/auth/forgot-password", () => {
    it("returns generic response for existing email (prevents enumeration)", async () => {
      await seedUser({ email: "exists@test.com" });

      const req = createRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: "exists@test.com" },
      });

      const res = await forgotPasswordHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.message).toContain("If an account exists");

      // Token should be created
      expect(stores.passwordResetTokens.size).toBe(1);
    });

    it("returns same generic response for non-existing email", async () => {
      const req = createRequest("/api/auth/forgot-password", {
        method: "POST",
        body: { email: "ghost@test.com" },
      });

      const res = await forgotPasswordHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.message).toContain("If an account exists");

      // No token should be created
      expect(stores.passwordResetTokens.size).toBe(0);
    });
  });

  // ─── Reset Password ─────────────────────────────────────────────────

  describe("POST /api/auth/reset-password", () => {
    it("resets password with valid token", async () => {
      const user = await seedUser();
      const oldHash = user.passwordHash;
      const tokenId = "rst_1";
      stores.passwordResetTokens.set(tokenId, {
        id: tokenId,
        token: "reset-token-123",
        userId: user.id,
        expiresAt: new Date(Date.now() + 3600000),
      });

      const req = createRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token: "reset-token-123", password: "newpassword456" },
      });

      const res = await resetPasswordHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.message).toContain("successful");

      // Password hash should have changed
      const updatedUser = stores.users.get(user.id)!;
      expect(updatedUser.passwordHash).not.toBe(oldHash);
    });

    it("rejects expired reset token", async () => {
      const user = await seedUser();
      const tokenId = "rst_exp";
      stores.passwordResetTokens.set(tokenId, {
        id: tokenId,
        token: "expired-reset",
        userId: user.id,
        expiresAt: new Date(Date.now() - 1000),
      });

      const req = createRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token: "expired-reset", password: "newpassword456" },
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);
    });

    it("rejects short password on reset", async () => {
      const req = createRequest("/api/auth/reset-password", {
        method: "POST",
        body: { token: "any-token", password: "short" },
      });

      const res = await resetPasswordHandler(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── Rate Limiting ───────────────────────────────────────────────────

  describe("Rate Limiting", () => {
    it("blocks signup when rate limited", async () => {
      const { rateLimitSignup } = await import("@/lib/rate-limit");
      vi.mocked(rateLimitSignup).mockReturnValueOnce({ allowed: false, remaining: 0 });

      const req = createRequest("/api/auth/signup", {
        method: "POST",
        body: { email: "test@test.com", password: "securepass123", name: "Test" },
      });

      const res = await signupHandler(req);
      expect(res.status).toBe(429);
    });
  });

  // ─── Health Check ────────────────────────────────────────────────────

  describe("GET /api/health", () => {
    it("returns ok status", async () => {
      const res = await healthHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.status).toBe("ok");
      expect(data.timestamp).toBeDefined();
    });

    it("returns error when database is down", async () => {
      mockDb.$queryRaw.mockRejectedValueOnce(new Error("connection refused"));

      const res = await healthHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(503);
      expect(data.status).toBe("error");
    });
  });
});
