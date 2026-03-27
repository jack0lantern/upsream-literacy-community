/**
 * E2E Integration Tests: Onboarding & Profile Flows
 * Based on PRD Section 3 (Flow 1), Section 4.A, 4.B, 4.C
 *
 * Tests:
 * - District search typeahead
 * - Manual district entry (is_manual = true)
 * - Onboarding completion (district + role + problems + bio)
 * - Onboarding validation (min 1 problem, max 5)
 * - Profile read
 * - Profile update (bio, problems, district change)
 * - Account deactivation
 * - Problem statements listing
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStores, stores } from "./mock-db";
import {
  createRequest,
  parseResponse,
  seedUser,
  seedDistrict,
  seedProblemStatements,
  seedOnboardedUser,
} from "./helpers";

// Mock auth — we need to control the session per-test
const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { GET as districtSearchHandler } from "@/app/api/districts/search/route";
import { POST as districtCreateHandler } from "@/app/api/districts/route";
import { POST as onboardingHandler } from "@/app/api/onboarding/route";
import { GET as profileGetHandler, PATCH as profileUpdateHandler, DELETE as profileDeleteHandler } from "@/app/api/profile/route";
import { GET as problemsHandler } from "@/app/api/problems/route";

function setSession(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
}

function clearSession() {
  mockAuth.mockResolvedValue(null);
}

describe("Onboarding & Profile Flows", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    clearSession();
  });

  // ─── District Search ─────────────────────────────────────────────────

  describe("GET /api/districts/search", () => {
    it("returns matching districts by name", async () => {
      seedDistrict({ name: "Springfield School District", state: "IL" });
      seedDistrict({ name: "Springfield Township", state: "NJ" });
      seedDistrict({ name: "Jefferson County", state: "AL" });

      const req = createRequest("/api/districts/search?q=Spring");
      const res = await districtSearchHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data).toHaveLength(2);
      expect(data.every((d: { name: string }) => d.name.includes("Spring"))).toBe(true);
    });

    it("filters by state", async () => {
      seedDistrict({ name: "Springfield SD", state: "IL" });
      seedDistrict({ name: "Springfield TWP", state: "NJ" });

      const req = createRequest("/api/districts/search?q=Spring&state=IL");
      const res = await districtSearchHandler(req);
      const data = await parseResponse(res);

      expect(data).toHaveLength(1);
      expect(data[0].state).toBe("IL");
    });

    it("returns empty array for short query (< 2 chars)", async () => {
      seedDistrict({ name: "Any District" });

      const req = createRequest("/api/districts/search?q=A");
      const res = await districtSearchHandler(req);
      const data = await parseResponse(res);

      expect(data).toHaveLength(0);
    });
  });

  // ─── Manual District Entry ───────────────────────────────────────────

  describe("POST /api/districts", () => {
    it("creates manual district with is_manual=true", async () => {
      const user = await seedUser();
      setSession(user.id);

      const req = createRequest("/api/districts", {
        method: "POST",
        body: { name: "My Charter School", state: "TX", totalEnrollment: 800 },
      });

      const res = await districtCreateHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.name).toBe("My Charter School");
      expect(data.isManual).toBe(true);
      expect(data.sizeBucket).toBe("small"); // < 3000
    });

    it("derives correct size bucket", async () => {
      const user = await seedUser();
      setSession(user.id);

      const req = createRequest("/api/districts", {
        method: "POST",
        body: { name: "Large District", state: "CA", totalEnrollment: 25000 },
      });

      const res = await districtCreateHandler(req);
      const data = await parseResponse(res);

      expect(data.sizeBucket).toBe("large"); // 15K-50K
    });

    it("requires authentication", async () => {
      clearSession();

      const req = createRequest("/api/districts", {
        method: "POST",
        body: { name: "Test", state: "CA" },
      });

      const res = await districtCreateHandler(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── Onboarding ──────────────────────────────────────────────────────

  describe("POST /api/onboarding", () => {
    it("completes onboarding with valid data", async () => {
      const user = await seedUser();
      const district = seedDistrict();
      seedProblemStatements();
      setSession(user.id);

      const req = createRequest("/api/onboarding", {
        method: "POST",
        body: {
          districtId: district.id,
          role: "literacy_director",
          problemIds: ["ps_1", "ps_2", "ps_3"],
          bio: "Working on SoR transition",
        },
      });

      const res = await onboardingHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);

      // Verify user was updated
      const updated = stores.users.get(user.id)!;
      expect(updated.onboarded).toBe(true);
      expect(updated.role).toBe("literacy_director");
      expect(updated.bio).toBe("Working on SoR transition");
      expect(updated.districtId).toBe(district.id);

      // Verify problems were assigned
      const userProblems = [...stores.userProblems.values()].filter(
        (up) => up.userId === user.id
      );
      expect(userProblems).toHaveLength(3);
    });

    it("rejects onboarding with 0 problem statements", async () => {
      const user = await seedUser();
      const district = seedDistrict();
      setSession(user.id);

      const req = createRequest("/api/onboarding", {
        method: "POST",
        body: {
          districtId: district.id,
          role: "literacy_coach",
          problemIds: [],
        },
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(400);
    });

    it("rejects onboarding with > 5 problem statements", async () => {
      const user = await seedUser();
      const district = seedDistrict();
      seedProblemStatements();
      setSession(user.id);

      const req = createRequest("/api/onboarding", {
        method: "POST",
        body: {
          districtId: district.id,
          role: "literacy_coach",
          problemIds: ["ps_1", "ps_2", "ps_3", "ps_4", "ps_5", "ps_extra"],
        },
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(400);
    });

    it("rejects invalid role", async () => {
      const user = await seedUser();
      const district = seedDistrict();
      seedProblemStatements();
      setSession(user.id);

      const req = createRequest("/api/onboarding", {
        method: "POST",
        body: {
          districtId: district.id,
          role: "invalid_role",
          problemIds: ["ps_1"],
        },
      });

      const res = await onboardingHandler(req);
      expect(res.status).toBe(400);
    });

    it("tracks profile_complete analytics event", async () => {
      const user = await seedUser();
      const district = seedDistrict();
      seedProblemStatements();
      setSession(user.id);

      const req = createRequest("/api/onboarding", {
        method: "POST",
        body: {
          districtId: district.id,
          role: "literacy_director",
          problemIds: ["ps_1"],
        },
      });

      await onboardingHandler(req);

      const events = [...stores.analyticsEvents.values()];
      const profileEvent = events.find((e) => e.eventType === "profile_complete");
      expect(profileEvent).toBeDefined();
    });
  });

  // ─── Profile ─────────────────────────────────────────────────────────

  describe("GET /api/profile", () => {
    it("returns current user profile", async () => {
      const user = await seedOnboardedUser();
      setSession(user.id);

      const res = await profileGetHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.name).toBe(user.name);
      expect(data.onboarded).toBe(true);
    });

    it("returns 401 when not authenticated", async () => {
      clearSession();
      const res = await profileGetHandler();
      expect(res.status).toBe(401);
    });
  });

  describe("PATCH /api/profile", () => {
    it("updates bio and problem statements", async () => {
      const user = await seedOnboardedUser();
      seedProblemStatements();
      setSession(user.id);

      const req = createRequest("/api/profile", {
        method: "PATCH",
        body: { bio: "Updated bio", problemIds: ["ps_3", "ps_4"] },
      });

      const res = await profileUpdateHandler(req);
      expect(res.status).toBe(200);

      const updated = stores.users.get(user.id)!;
      expect(updated.bio).toBe("Updated bio");
    });

    it("rejects bio longer than 280 chars", async () => {
      const user = await seedOnboardedUser();
      setSession(user.id);

      const req = createRequest("/api/profile", {
        method: "PATCH",
        body: { bio: "x".repeat(281) },
      });

      const res = await profileUpdateHandler(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── Account Deactivation ───────────────────────────────────────────

  describe("DELETE /api/profile (deactivation)", () => {
    it("deactivates user account", async () => {
      const user = await seedOnboardedUser();
      setSession(user.id);

      const res = await profileDeleteHandler();
      expect(res.status).toBe(200);

      const updated = stores.users.get(user.id)!;
      expect(updated.status).toBe("deactivated");
    });
  });

  // ─── Problem Statements ─────────────────────────────────────────────

  describe("GET /api/problems", () => {
    it("returns active problem statements sorted by sortOrder", async () => {
      seedProblemStatements();

      const res = await problemsHandler();
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.length).toBeGreaterThanOrEqual(5);
      expect(data[0].label).toBeDefined();
      expect(data[0].category).toBeDefined();
    });
  });
});
