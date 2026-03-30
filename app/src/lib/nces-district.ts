/**
 * NCES District derivation utilities.
 *
 * Pure functions that map raw NCES field values to the application's
 * domain types (Urbanicity, SizeBucket).  No Prisma or DB dependency —
 * import-safe for scripts and unit tests alike.
 */

// ── Type aliases matching Prisma enum values ─────────────────────────────────

export type Urbanicity = "urban" | "suburban" | "town" | "rural";

export type SizeBucket = "small" | "medium" | "large" | "very_large";

// ── localeCodeToUrbanicity ────────────────────────────────────────────────────

/**
 * Map an NCES 12-way locale code to an Urbanicity value.
 *
 * NCES locale code structure:
 *   First digit = broad category:  1=City, 2=Suburb, 3=Town, 4=Rural
 *   Second digit = sub-type:       1=Large, 2=Midsize, 3=Small
 *
 *   11 City, Large        → urban
 *   12 City, Midsize      → urban
 *   13 City, Small        → urban
 *   21 Suburb, Large      → suburban
 *   22 Suburb, Midsize    → suburban
 *   23 Suburb, Small      → suburban
 *   31 Town, Fringe       → town
 *   32 Town, Distant      → town
 *   33 Town, Remote       → town
 *   41 Rural, Fringe      → rural
 *   42 Rural, Distant     → rural
 *   43 Rural, Remote      → rural
 *
 * @param code - NCES locale code as a string (e.g. "11", "42"), or null.
 * @returns Urbanicity value, or null if the code is null / unrecognised.
 */
export function localeCodeToUrbanicity(code: string | null): Urbanicity | null {
  if (code === null) return null;

  switch (code) {
    case "11":
    case "12":
    case "13":
      return "urban";
    case "21":
    case "22":
    case "23":
      return "suburban";
    case "31":
    case "32":
    case "33":
      return "town";
    case "41":
    case "42":
    case "43":
      return "rural";
    default:
      return null;
  }
}

// ── enrollmentToSizeBucket ────────────────────────────────────────────────────

/**
 * Bucket a district's total student enrollment into a SizeBucket.
 *
 * Thresholds (PRD Section 4.D):
 *   < 3,000        → small
 *   3,000–14,999   → medium
 *   15,000–49,999  → large
 *   ≥ 50,000       → very_large
 *
 * @param n - Total enrollment count, or null if unknown.
 * @returns SizeBucket value, or null if n is null.
 */
export function enrollmentToSizeBucket(n: number | null): SizeBucket | null {
  if (n === null) return null;

  if (n < 3_000) return "small";
  if (n < 15_000) return "medium";
  if (n < 50_000) return "large";
  return "very_large";
}

// ── leaTypeToIsCharterAgency ──────────────────────────────────────────────────

/**
 * Determine whether a district is a charter agency from the NCES LEA type code.
 *
 * Known NCES LEA type values:
 *   1  Regular local school district not part of a supervisory union
 *   2  Local school district that is part of a supervisory union
 *   3  Supervisory union
 *   4  Regional education service agency
 *   5  State-operated agency
 *   6  Federally-operated agency
 *   7  Charter agency          ← isCharterAgency = true
 *   8  Other education agency
 *
 * @param type - NCES LEA type code, or null if absent.
 * @returns true if the district is a charter agency (type 7),
 *          false for any other recognised type,
 *          null if type is null or not in the known set.
 */
export function leaTypeToIsCharterAgency(type: number | null): boolean | null {
  if (type === null) return null;

  switch (type) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
      return false;
    case 7:
      return true;
    case 8:
      return false;
    default:
      return null;
  }
}
