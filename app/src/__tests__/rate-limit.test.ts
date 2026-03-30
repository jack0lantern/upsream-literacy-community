/**
 * P5.3: Rate limiting verification
 */
import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, rateLimitLogin, rateLimitSignup, rateLimitMessaging } from "@/lib/rate-limit";

describe("Rate Limiting", () => {
  // Use unique keys per test to avoid cross-test pollution
  const uniqueKey = () => `test_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  describe("rateLimit()", () => {
    it("allows requests within limit", () => {
      const key = uniqueKey();
      const r1 = rateLimit(key, 3, 60_000);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);

      const r2 = rateLimit(key, 3, 60_000);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);

      const r3 = rateLimit(key, 3, 60_000);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
    });

    it("blocks requests exceeding limit", () => {
      const key = uniqueKey();
      for (let i = 0; i < 3; i++) {
        rateLimit(key, 3, 60_000);
      }
      const blocked = rateLimit(key, 3, 60_000);
      expect(blocked.allowed).toBe(false);
      expect(blocked.remaining).toBe(0);
    });

    it("resets after window expires", async () => {
      const key = uniqueKey();
      // Fill up the limit with a 50ms window
      for (let i = 0; i < 5; i++) {
        rateLimit(key, 5, 50);
      }
      // Should be blocked now
      expect(rateLimit(key, 5, 50).allowed).toBe(false);
      // Wait for window to expire
      await new Promise((r) => setTimeout(r, 60));
      const result = rateLimit(key, 5, 50);
      expect(result.allowed).toBe(true);
    });

    it("tracks different keys independently", () => {
      const key1 = uniqueKey();
      const key2 = uniqueKey();

      // Exhaust key1
      for (let i = 0; i < 2; i++) {
        rateLimit(key1, 2, 60_000);
      }
      expect(rateLimit(key1, 2, 60_000).allowed).toBe(false);

      // key2 should still work
      expect(rateLimit(key2, 2, 60_000).allowed).toBe(true);
    });
  });

  describe("preset limiters", () => {
    it("rateLimitLogin allows 5 per minute", () => {
      const ip = uniqueKey();
      for (let i = 0; i < 5; i++) {
        expect(rateLimitLogin(ip).allowed).toBe(true);
      }
      expect(rateLimitLogin(ip).allowed).toBe(false);
    });

    it("rateLimitSignup allows 3 per minute", () => {
      const ip = uniqueKey();
      for (let i = 0; i < 3; i++) {
        expect(rateLimitSignup(ip).allowed).toBe(true);
      }
      expect(rateLimitSignup(ip).allowed).toBe(false);
    });

    it("rateLimitMessaging allows 30 per minute", () => {
      const userId = uniqueKey();
      for (let i = 0; i < 30; i++) {
        expect(rateLimitMessaging(userId).allowed).toBe(true);
      }
      expect(rateLimitMessaging(userId).allowed).toBe(false);
    });
  });
});
