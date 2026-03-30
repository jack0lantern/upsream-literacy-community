/**
 * import-nces-districts.ts
 *
 * CLI script to bulk-import NCES district data into the districts table.
 *
 * Usage:
 *   pnpm run import:nces [path/to/nces-districts.csv]
 *
 * Or via env var:
 *   NCES_CSV_PATH=path/to/file.csv pnpm run import:nces
 *
 * CSV format expected:
 *   LEAID,LEA_NAME,STATE_ABBR,LOCALE,TOTAL,FREE_REDUCED_LUNCH_ELIGIBLE,ENGLISH_LEARNERS,LEA_TYPE
 *
 * Suppressed values (-1, -2, -9) and empty strings are treated as null.
 * Only upserts rows with isManual: false — preserves manually created districts.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  localeCodeToUrbanicity,
  enrollmentToSizeBucket,
  leaTypeToIsCharterAgency,
} from "../src/lib/nces-district";

// ── Environment ───────────────────────────────────────────────────────────────

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env or .env.local in the app directory.",
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: databaseUrl }),
});

// ── Constants ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 500;
const SUPPRESSED_VALUES = new Set([-1, -2, -9]);
const DEFAULT_CSV_PATH = resolve(process.cwd(), "data", "nces-districts.csv");

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw CSV cell value into a number, treating suppressed NCES values
 * (-1, -2, -9) and empty strings as null.
 */
function parseIntOrNull(val: string): number | null {
  const trimmed = val.trim();
  if (!trimmed) return null;
  const n = parseInt(trimmed, 10);
  if (isNaN(n)) return null;
  if (SUPPRESSED_VALUES.has(n)) return null;
  return n;
}

/**
 * Parse a raw CSV cell value into a string, treating empty strings as null.
 */
function parseStrOrNull(val: string): string | null {
  const trimmed = val.trim();
  return trimmed === "" ? null : trimmed;
}

/**
 * Compute a percentage to one decimal place (e.g. 52.3).
 * Returns null when total is null or 0.
 * Caps at 100 to handle NCES data where counts can exceed total.
 */
function computePct(count: number | null, total: number | null): number | null {
  if (total === null || total === 0 || count === null) return null;
  const raw = (count / total) * 100;
  return Math.min(100, Math.round(raw * 10) / 10);
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

interface NcesRow {
  leaid: string;
  leaName: string;
  stateAbbr: string;
  locale: string | null;
  total: number | null;
  frlEligible: number | null;
  englishLearners: number | null;
  leaType: number | null;
}

function parseCsv(filePath: string): NcesRow[] {
  const raw = readFileSync(filePath, "utf-8");
  const lines = raw.split(/\r?\n/);

  if (lines.length === 0) {
    throw new Error("CSV file is empty.");
  }

  // Parse header to find column indices (defensive, in case column order varies)
  const header = lines[0]
    .split(",")
    .map((h) => h.trim().toUpperCase().replace(/['"]/g, ""));

  const idx = {
    LEAID: header.indexOf("LEAID"),
    LEA_NAME: header.indexOf("LEA_NAME"),
    STATE_ABBR: header.indexOf("STATE_ABBR"),
    LOCALE: header.indexOf("LOCALE"),
    TOTAL: header.indexOf("TOTAL"),
    FREE_REDUCED_LUNCH_ELIGIBLE: header.indexOf("FREE_REDUCED_LUNCH_ELIGIBLE"),
    ENGLISH_LEARNERS: header.indexOf("ENGLISH_LEARNERS"),
    LEA_TYPE: header.indexOf("LEA_TYPE"),
  };

  // Validate required columns
  for (const [col, i] of Object.entries(idx)) {
    if (i === -1) {
      throw new Error(`Required column "${col}" not found in CSV header. Found: ${header.join(", ")}`);
    }
  }

  const rows: NcesRow[] = [];

  for (let lineNum = 1; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum].trim();
    if (!line) continue; // skip blank lines

    // Split on comma — NCES data does not use commas in district names
    const cols = line.split(",");

    const leaid = parseStrOrNull(cols[idx.LEAID] ?? "");
    if (!leaid) {
      // Skip rows without a valid LEAID
      continue;
    }

    rows.push({
      leaid,
      leaName: parseStrOrNull(cols[idx.LEA_NAME] ?? "") ?? leaid,
      stateAbbr: parseStrOrNull(cols[idx.STATE_ABBR] ?? "") ?? "",
      locale: parseStrOrNull(cols[idx.LOCALE] ?? ""),
      total: parseIntOrNull(cols[idx.TOTAL] ?? ""),
      frlEligible: parseIntOrNull(cols[idx.FREE_REDUCED_LUNCH_ELIGIBLE] ?? ""),
      englishLearners: parseIntOrNull(cols[idx.ENGLISH_LEARNERS] ?? ""),
      leaType: parseIntOrNull(cols[idx.LEA_TYPE] ?? ""),
    });
  }

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const csvPath =
    process.argv[2] ?? process.env.NCES_CSV_PATH ?? DEFAULT_CSV_PATH;

  console.log(`NCES District Import`);
  console.log(`Reading CSV: ${csvPath}\n`);

  const rows = parseCsv(csvPath);
  console.log(`Parsed ${rows.length} rows from CSV.\n`);

  let upserted = 0;

  for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
    const batch = rows.slice(batchStart, batchStart + BATCH_SIZE);

    await prisma.$transaction(
      batch.map((row) => {
        const urbanicity = localeCodeToUrbanicity(row.locale);
        // enrollmentToSizeBucket already returns null for null input;
        // we additionally want null when enrollment is 0 (no students → unknown size)
        const sizeBucket =
          row.total === 0 ? null : enrollmentToSizeBucket(row.total);
        const isCharterAgency = leaTypeToIsCharterAgency(row.leaType);
        const frlPct = computePct(row.frlEligible, row.total);
        const ellPct = computePct(row.englishLearners, row.total);

        const data = {
          name: row.leaName,
          state: row.stateAbbr,
          localeCode: row.locale,
          urbanicity,
          totalEnrollment: row.total,
          sizeBucket,
          frlPct,
          ellPct,
          isCharterAgency,
        };

        return prisma.district.upsert({
          where: { ncesId: row.leaid },
          // On conflict: update derived fields but preserve isManual
          update: data,
          create: { ncesId: row.leaid, ...data, isManual: false },
        });
      }),
    );

    upserted += batch.length;

    if (upserted % 1000 === 0 || upserted === rows.length) {
      console.log(`  Progress: ${upserted} / ${rows.length} rows processed`);
    }
  }

  console.log(`\nImport complete: ${upserted} districts upserted.`);
}

main()
  .catch((e) => {
    console.error("Import failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
