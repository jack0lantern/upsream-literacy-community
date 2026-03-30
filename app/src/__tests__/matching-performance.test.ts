/**
 * P5.2: Matching engine performance test
 * Verify scoring functions work correctly and measure performance characteristics
 */
import { describe, it, expect } from "vitest";

// Reproduce scoring functions from matches/route.ts for unit testing
const URBANICITY_ADJACENCY: Record<string, string[]> = {
  urban: ["suburban"],
  suburban: ["urban", "town"],
  town: ["suburban", "rural"],
  rural: ["town"],
};

const SIZE_ORDER = ["small", "medium", "large", "very_large"];

function sizeBucketDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 3;
  const ai = SIZE_ORDER.indexOf(a);
  const bi = SIZE_ORDER.indexOf(b);
  if (ai === -1 || bi === -1) return 3;
  return Math.abs(ai - bi);
}

function urbanicityScore(a: string | null, b: string | null): number {
  if (!a || !b) return 10;
  if (a === b) return 20;
  if (URBANICITY_ADJACENCY[a]?.includes(b)) return 10;
  return 0;
}

function sizeScore(a: string | null, b: string | null): number {
  if (!a || !b) return 10;
  const dist = sizeBucketDistance(a, b);
  if (dist === 0) return 20;
  if (dist === 1) return 10;
  return 0;
}

function frlScore(a: number | null, b: number | null): number {
  if (a == null || b == null) return 5;
  return Math.max(0, 10 - Math.abs(a - b) / 5);
}

function ellScore(a: number | null, b: number | null): number {
  if (a == null || b == null) return 5;
  return Math.max(0, 10 - Math.abs(a - b) / 3);
}

function computeMatchScore(
  myProblems: string[],
  theirProblems: string[],
  myDistrict: { urbanicity: string | null; sizeBucket: string | null; frlPct: number | null; ellPct: number | null },
  theirDistrict: { urbanicity: string | null; sizeBucket: string | null; frlPct: number | null; ellPct: number | null }
): number {
  const mySet = new Set(myProblems);
  const theirSet = new Set(theirProblems);
  const shared = [...mySet].filter((id) => theirSet.has(id));
  const maxProblems = Math.max(mySet.size, theirSet.size);
  const problemScore = maxProblems > 0 ? (shared.length / maxProblems) * 40 : 0;

  return Math.round(
    problemScore +
    sizeScore(myDistrict.sizeBucket, theirDistrict.sizeBucket) +
    urbanicityScore(myDistrict.urbanicity, theirDistrict.urbanicity) +
    frlScore(myDistrict.frlPct, theirDistrict.frlPct) +
    ellScore(myDistrict.ellPct, theirDistrict.ellPct)
  );
}

describe("Matching Engine", () => {
  describe("urbanicityScore", () => {
    it("returns 20 for exact match", () => {
      expect(urbanicityScore("urban", "urban")).toBe(20);
      expect(urbanicityScore("rural", "rural")).toBe(20);
    });

    it("returns 10 for adjacent types", () => {
      expect(urbanicityScore("urban", "suburban")).toBe(10);
      expect(urbanicityScore("town", "rural")).toBe(10);
    });

    it("returns 0 for non-adjacent types", () => {
      expect(urbanicityScore("urban", "rural")).toBe(0);
      expect(urbanicityScore("urban", "town")).toBe(0);
    });

    it("returns 10 (neutral) for null values", () => {
      expect(urbanicityScore(null, "urban")).toBe(10);
      expect(urbanicityScore("urban", null)).toBe(10);
    });
  });

  describe("sizeScore", () => {
    it("returns 20 for exact match", () => {
      expect(sizeScore("small", "small")).toBe(20);
      expect(sizeScore("large", "large")).toBe(20);
    });

    it("returns 10 for adjacent sizes", () => {
      expect(sizeScore("small", "medium")).toBe(10);
      expect(sizeScore("large", "very_large")).toBe(10);
    });

    it("returns 0 for distant sizes", () => {
      expect(sizeScore("small", "large")).toBe(0);
      expect(sizeScore("small", "very_large")).toBe(0);
    });
  });

  describe("frlScore", () => {
    it("returns 10 for identical FRL%", () => {
      expect(frlScore(50, 50)).toBe(10);
    });

    it("returns lower score for greater difference", () => {
      const close = frlScore(50, 55);
      const far = frlScore(50, 70);
      expect(close).toBeGreaterThan(far);
    });

    it("returns 5 (neutral) for null values", () => {
      expect(frlScore(null, 50)).toBe(5);
      expect(frlScore(50, null)).toBe(5);
    });

    it("never goes below 0", () => {
      expect(frlScore(0, 100)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("ellScore", () => {
    it("returns 10 for identical ELL%", () => {
      expect(ellScore(20, 20)).toBe(10);
    });

    it("returns 5 (neutral) for null values", () => {
      expect(ellScore(null, 20)).toBe(5);
    });

    it("never goes below 0", () => {
      expect(ellScore(0, 100)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("computeMatchScore", () => {
    const baseDistrict = { urbanicity: "suburban", sizeBucket: "medium", frlPct: 45.0, ellPct: 12.0 };

    it("returns max score for perfect match", () => {
      const score = computeMatchScore(
        ["p1", "p2", "p3"],
        ["p1", "p2", "p3"],
        baseDistrict,
        baseDistrict
      );
      // 40 (problems) + 20 (size) + 20 (urbanicity) + 10 (frl) + 10 (ell) = 100
      expect(score).toBe(100);
    });

    it("returns 0 problem score with no overlap", () => {
      const score = computeMatchScore(
        ["p1", "p2"],
        ["p3", "p4"],
        baseDistrict,
        baseDistrict
      );
      // 0 (problems) + 20 + 20 + 10 + 10 = 60
      expect(score).toBe(60);
    });

    it("correctly weighs partial problem overlap", () => {
      const score = computeMatchScore(
        ["p1", "p2", "p3", "p4"],
        ["p1", "p2", "p5", "p6"],
        baseDistrict,
        baseDistrict
      );
      // 2/4 * 40 = 20 (problems) + 20 + 20 + 10 + 10 = 80
      expect(score).toBe(80);
    });

    it("minimum threshold of 30 filters weak matches", () => {
      const score = computeMatchScore(
        ["p1"],
        ["p2"],
        { urbanicity: "urban", sizeBucket: "small", frlPct: 10, ellPct: 5 },
        { urbanicity: "rural", sizeBucket: "very_large", frlPct: 90, ellPct: 50 }
      );
      // 0 (problems) + 0 (size) + 0 (urbanicity) + low frl + low ell
      expect(score).toBeLessThan(30);
    });
  });

  describe("performance", () => {
    it("scores 5000 candidates in under 500ms", () => {
      const myProblems = ["p1", "p2", "p3"];
      const myDistrict = { urbanicity: "suburban", sizeBucket: "medium", frlPct: 45, ellPct: 12 };

      const candidates = Array.from({ length: 5000 }, (_, i) => ({
        problems: [`p${(i % 5) + 1}`, `p${((i + 1) % 5) + 1}`],
        district: {
          urbanicity: ["urban", "suburban", "town", "rural"][i % 4],
          sizeBucket: SIZE_ORDER[i % 4],
          frlPct: Math.random() * 100,
          ellPct: Math.random() * 50,
        },
      }));

      const start = performance.now();
      const scores = candidates.map((c) =>
        computeMatchScore(myProblems, c.problems, myDistrict, c.district)
      );
      scores.sort((a, b) => b - a);
      const elapsed = performance.now() - start;

      expect(elapsed).toBeLessThan(500);
      expect(scores.length).toBe(5000);
    });
  });
});
