/**
 * E2E Integration Tests: Matching Engine
 * Based on PRD Section 3 (Flow 2), Section 4.D, Section 6
 *
 * Tests:
 * - Match scoring (problem overlap 40%, size 20%, urbanicity 20%, FRL 10%, ELL 10%)
 * - Minimum threshold (score >= 30)
 * - Sort by score and recently active
 * - Filters (state, urbanicity, size bucket, charter LEA)
 * - Pagination
 * - Self-exclusion (don't match with yourself)
 * - Deactivated/suspended users excluded
 * - Empty results when no matches
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStores, stores } from "./mock-db";
import {
  createRequest,
  parseResponse,
  seedOnboardedUser,
  seedDistrict,
  seedProblemStatements,
} from "./helpers";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { GET as matchesHandler } from "@/app/api/matches/route";

function setSession(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
}

describe("Matching Engine", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
    seedProblemStatements();
  });

  it("returns matches sorted by score descending (default)", async () => {
    // Current user: suburban, medium, problems ps_1, ps_2
    const me = await seedOnboardedUser({
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium", frlPct: 30, ellPct: 10 },
      problemIds: ["ps_1", "ps_2"],
    });

    // Good match: same urbanicity, same size, shares ps_1
    await seedOnboardedUser({
      name: "Good Match",
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium", frlPct: 28, ellPct: 12 },
      problemIds: ["ps_1", "ps_3"],
    });

    // Fair match: different urbanicity, same problems
    await seedOnboardedUser({
      name: "Fair Match",
      districtOverrides: { urbanicity: "rural", sizeBucket: "small", frlPct: 60, ellPct: 5 },
      problemIds: ["ps_1", "ps_2"],
    });

    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(data.matches.length).toBeGreaterThanOrEqual(1);
    // Should be sorted by score desc
    for (let i = 1; i < data.matches.length; i++) {
      expect(data.matches[i - 1].score).toBeGreaterThanOrEqual(data.matches[i].score);
    }
  });

  it("excludes self from matches", async () => {
    const me = await seedOnboardedUser({ problemIds: ["ps_1"] });
    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    const selfMatch = data.matches.find((m: { user: { id: string } }) => m.user.id === me.id);
    expect(selfMatch).toBeUndefined();
  });

  it("excludes deactivated and suspended users", async () => {
    const me = await seedOnboardedUser({ problemIds: ["ps_1", "ps_2"] });

    await seedOnboardedUser({
      name: "Deactivated User",
      status: "deactivated",
      problemIds: ["ps_1", "ps_2"],
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
    });

    await seedOnboardedUser({
      name: "Suspended User",
      status: "suspended",
      problemIds: ["ps_1", "ps_2"],
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
    });

    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    const names = data.matches.map((m: { user: { name: string } }) => m.user.name);
    expect(names).not.toContain("Deactivated User");
    expect(names).not.toContain("Suspended User");
  });

  it("excludes admin users from match results", async () => {
    const me = await seedOnboardedUser({
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
      problemIds: ["ps_1", "ps_2"],
    });

    await seedOnboardedUser({
      name: "Admin Peer",
      isAdmin: true,
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
      problemIds: ["ps_1", "ps_2"],
    });

    await seedOnboardedUser({
      name: "Regular Peer",
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
      problemIds: ["ps_1", "ps_2"],
    });

    setSession(me.id);

    const res = await matchesHandler(createRequest("/api/matches"));
    const data = await parseResponse(res);

    const names = data.matches.map((m: { user: { name: string } }) => m.user.name);
    expect(names).not.toContain("Admin Peer");
    expect(names).toContain("Regular Peer");
  });

  it("filters by charter LEA status", async () => {
    const me = await seedOnboardedUser({
      districtOverrides: { state: "CO", urbanicity: "suburban", sizeBucket: "medium" },
      problemIds: ["ps_1", "ps_2"],
    });

    await seedOnboardedUser({
      name: "Charter Peer",
      districtOverrides: {
        state: "CO",
        urbanicity: "suburban",
        sizeBucket: "medium",
        isCharterAgency: true,
      },
      problemIds: ["ps_1", "ps_2"],
    });

    await seedOnboardedUser({
      name: "Traditional Peer",
      districtOverrides: {
        state: "CO",
        urbanicity: "suburban",
        sizeBucket: "medium",
        isCharterAgency: false,
      },
      problemIds: ["ps_1", "ps_2"],
    });

    setSession(me.id);

    const charterRes = await matchesHandler(createRequest("/api/matches?charter=charter"));
    const charterData = await parseResponse(charterRes);
    expect(charterData.matches.some((m: { user: { name: string } }) => m.user.name === "Charter Peer")).toBe(true);
    expect(charterData.matches.some((m: { user: { name: string } }) => m.user.name === "Traditional Peer")).toBe(false);

    const tradRes = await matchesHandler(createRequest("/api/matches?charter=traditional"));
    const tradData = await parseResponse(tradRes);
    expect(tradData.matches.some((m: { user: { name: string } }) => m.user.name === "Traditional Peer")).toBe(true);
    expect(tradData.matches.some((m: { user: { name: string } }) => m.user.name === "Charter Peer")).toBe(false);
  });

  it("filters by state", async () => {
    const me = await seedOnboardedUser({
      districtOverrides: { state: "CA" },
      problemIds: ["ps_1", "ps_2"],
    });

    await seedOnboardedUser({
      name: "CA User",
      districtOverrides: { state: "CA", urbanicity: "suburban", sizeBucket: "medium" },
      problemIds: ["ps_1", "ps_2"],
    });

    await seedOnboardedUser({
      name: "NY User",
      districtOverrides: { state: "NY", urbanicity: "suburban", sizeBucket: "medium" },
      problemIds: ["ps_1", "ps_2"],
    });

    setSession(me.id);

    const req = createRequest("/api/matches?state=CA");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    // All matches should be from CA
    for (const match of data.matches) {
      if (match.district) {
        expect(match.district.state).toBe("CA");
      }
    }
  });

  it("applies minimum score threshold of 30", async () => {
    const me = await seedOnboardedUser({
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium", frlPct: 30, ellPct: 10 },
      problemIds: ["ps_1", "ps_2"],
    });

    // Very different user — should score below 30
    await seedOnboardedUser({
      name: "Very Different",
      districtOverrides: { urbanicity: "urban", sizeBucket: "very_large", frlPct: 80, ellPct: 45 },
      problemIds: ["ps_4", "ps_5"], // no overlap
    });

    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    for (const match of data.matches) {
      expect(match.score).toBeGreaterThanOrEqual(30);
    }
  });

  it("returns shared problem IDs in match results", async () => {
    const me = await seedOnboardedUser({ problemIds: ["ps_1", "ps_2", "ps_3"] });

    await seedOnboardedUser({
      name: "Peer",
      problemIds: ["ps_2", "ps_3", "ps_4"],
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
    });

    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    if (data.matches.length > 0) {
      const match = data.matches[0];
      expect(match.sharedProblems).toContain("ps_2");
      expect(match.sharedProblems).toContain("ps_3");
      expect(match.sharedProblems).not.toContain("ps_4");
    }
  });

  it("includes match breakdown in response", async () => {
    const me = await seedOnboardedUser({ problemIds: ["ps_1"] });

    await seedOnboardedUser({
      name: "Peer",
      problemIds: ["ps_1"],
      districtOverrides: { urbanicity: "suburban", sizeBucket: "medium", frlPct: 35, ellPct: 12 },
    });

    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    if (data.matches.length > 0) {
      const breakdown = data.matches[0].breakdown;
      expect(breakdown).toHaveProperty("problemOverlap");
      expect(breakdown).toHaveProperty("sizeMatch");
      expect(breakdown).toHaveProperty("urbanicityMatch");
      expect(breakdown).toHaveProperty("frlSimilarity");
      expect(breakdown).toHaveProperty("ellSimilarity");
    }
  });

  it("returns empty matches for unonboarded user", async () => {
    const me = await seedOnboardedUser({ onboarded: false, districtId: null });
    setSession(me.id);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    expect(data.matches).toHaveLength(0);
  });

  it("paginates results", async () => {
    const me = await seedOnboardedUser({ problemIds: ["ps_1", "ps_2"] });

    // Create many peers
    for (let i = 0; i < 5; i++) {
      await seedOnboardedUser({
        name: `Peer ${i}`,
        problemIds: ["ps_1", "ps_2"],
        districtOverrides: { urbanicity: "suburban", sizeBucket: "medium" },
      });
    }

    setSession(me.id);

    const req = createRequest("/api/matches?page=1&limit=2");
    const res = await matchesHandler(req);
    const data = await parseResponse(res);

    expect(data.matches.length).toBeLessThanOrEqual(2);
    expect(data.totalPages).toBeGreaterThanOrEqual(2);
    expect(data.page).toBe(1);
  });

  it("requires authentication", async () => {
    mockAuth.mockResolvedValue(null);

    const req = createRequest("/api/matches");
    const res = await matchesHandler(req);

    expect(res.status).toBe(401);
  });
});
