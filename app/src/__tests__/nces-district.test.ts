/**
 * Unit tests for src/lib/nces-district.ts
 *
 * Covers:
 *  - localeCodeToUrbanicity: all 12 valid codes, null input, unrecognised input
 *  - enrollmentToSizeBucket: boundary values, null input
 *  - leaTypeToIsCharterAgency: all known LEA types (1-8), null, unknown
 */
import { describe, it, expect } from "vitest";
import {
  localeCodeToUrbanicity,
  enrollmentToSizeBucket,
  leaTypeToIsCharterAgency,
} from "@/lib/nces-district";

// ── localeCodeToUrbanicity ────────────────────────────────────────────────────

describe("localeCodeToUrbanicity", () => {
  describe("urban codes (11–13)", () => {
    it.each(["11", "12", "13"])('maps "%s" → "urban"', (code) => {
      expect(localeCodeToUrbanicity(code)).toBe("urban");
    });
  });

  describe("suburban codes (21–23)", () => {
    it.each(["21", "22", "23"])('maps "%s" → "suburban"', (code) => {
      expect(localeCodeToUrbanicity(code)).toBe("suburban");
    });
  });

  describe("town codes (31–33)", () => {
    it.each(["31", "32", "33"])('maps "%s" → "town"', (code) => {
      expect(localeCodeToUrbanicity(code)).toBe("town");
    });
  });

  describe("rural codes (41–43)", () => {
    it.each(["41", "42", "43"])('maps "%s" → "rural"', (code) => {
      expect(localeCodeToUrbanicity(code)).toBe("rural");
    });
  });

  it("returns null for null input", () => {
    expect(localeCodeToUrbanicity(null)).toBeNull();
  });

  it.each(["", "0", "10", "14", "20", "24", "40", "44", "99", "city", "1"])(
    'returns null for unrecognised code "%s"',
    (code) => {
      expect(localeCodeToUrbanicity(code)).toBeNull();
    },
  );
});

// ── enrollmentToSizeBucket ────────────────────────────────────────────────────

describe("enrollmentToSizeBucket", () => {
  it("returns null for null input", () => {
    expect(enrollmentToSizeBucket(null)).toBeNull();
  });

  describe("small bucket (< 3,000)", () => {
    it.each([0, 1, 2_999])("maps %i → small", (n) => {
      expect(enrollmentToSizeBucket(n)).toBe("small");
    });
  });

  describe("medium bucket (3,000–14,999)", () => {
    it.each([3_000, 3_001, 14_999])("maps %i → medium", (n) => {
      expect(enrollmentToSizeBucket(n)).toBe("medium");
    });
  });

  describe("large bucket (15,000–49,999)", () => {
    it.each([15_000, 15_001, 49_999])("maps %i → large", (n) => {
      expect(enrollmentToSizeBucket(n)).toBe("large");
    });
  });

  describe("very_large bucket (≥ 50,000)", () => {
    it.each([50_000, 50_001, 1_000_000])("maps %i → very_large", (n) => {
      expect(enrollmentToSizeBucket(n)).toBe("very_large");
    });
  });

  describe("exact boundary values", () => {
    it("2999 → small", () => expect(enrollmentToSizeBucket(2_999)).toBe("small"));
    it("3000 → medium", () => expect(enrollmentToSizeBucket(3_000)).toBe("medium"));
    it("14999 → medium", () => expect(enrollmentToSizeBucket(14_999)).toBe("medium"));
    it("15000 → large", () => expect(enrollmentToSizeBucket(15_000)).toBe("large"));
    it("49999 → large", () => expect(enrollmentToSizeBucket(49_999)).toBe("large"));
    it("50000 → very_large", () => expect(enrollmentToSizeBucket(50_000)).toBe("very_large"));
  });
});

// ── leaTypeToIsCharterAgency ──────────────────────────────────────────────────

describe("leaTypeToIsCharterAgency", () => {
  it("returns null for null input", () => {
    expect(leaTypeToIsCharterAgency(null)).toBeNull();
  });

  it("returns true for LEA type 7 (charter agency)", () => {
    expect(leaTypeToIsCharterAgency(7)).toBe(true);
  });

  it.each([1, 2, 3, 4, 5, 6, 8])(
    "returns false for non-charter LEA type %i",
    (type) => {
      expect(leaTypeToIsCharterAgency(type)).toBe(false);
    },
  );

  it.each([0, 9, 99, -1])(
    "returns null for unknown LEA type %i",
    (type) => {
      expect(leaTypeToIsCharterAgency(type)).toBeNull();
    },
  );
});
