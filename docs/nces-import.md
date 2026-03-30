# NCES District Data Import

This document describes the National Center for Education Statistics (NCES) Common Core of Data (CCD) import process for populating the Districts table with demographic information and district classification flags.

## Data Source & Version

- **Source:** NCES Common Core of Data (CCD)
- **School Year:** 2022–23 (most recent complete release)
- **Data Type:** Public Use Files (PUF)
- **Download:** https://nces.ed.gov/pubsearch/pubsinfo.asp?pubid=2024040

All district matching and scoring depends on accurate, normalized NCES LEA data. Use only the official NCES 2022–23 CCD files; do not mix school years.

## Import Workflow

### Step 1: Download CCD 2022–23 Files

From the NCES website (https://nces.ed.gov/pubsearch/pubsinfo.asp?pubid=2024040), download these three flat files:

1. **LEA file** (`ccd_sch_029_2223_l_02192024.txt`)
   - LEA-level demographic and enrollment data
   - Contains LEAID, LEA_NAME, TOTAL enrollment, FRL counts, ELL counts, and LEA_TYPE

2. **State/Agency file** (`ccd_agency_029_2223_w_02192024.txt`)
   - State abbreviations and locale codes
   - Contains STATE_NAME and LOCALE for state-level allocation

3. **Supporting documentation**
   - Data dictionary explaining all fields and suppression rules
   - Record layout guide (will clarify column positions if needed)

### Step 2: Create Unified CSV

Prepare a single CSV file with one row per LEA, containing all columns needed for import:

**CSV Column Headers:**
```
LEAID,LEA_NAME,STATE_ABBR,LOCALE,TOTAL,FREE_REDUCED_LUNCH_ELIGIBLE,ENGLISH_LEARNERS,LEA_TYPE
```

**Data Preparation Rules:**

- **LEAID:** 7-digit NCES LEA identifier (unique within the US). Use as-is from the CCD LEA file.
- **LEA_NAME:** LEA name from the CCD LEA file. Trim whitespace.
- **STATE_ABBR:** 2-letter state postal abbreviation (e.g., "CA", "TX", "NY"). Map from the CCD state file or use postal codes.
- **LOCALE:** 2-digit NCES locale code (e.g., "11" = city/urban, "21" = suburb, "33" = town, "43" = rural). From the CCD LEA file.
- **TOTAL:** Total student enrollment (integer). From the CCD LEA file field `TOTAL` or equivalent.
- **FREE_REDUCED_LUNCH_ELIGIBLE:** Count of students eligible for free or reduced-price lunch. From CCD field `FREE_REDUCED_LUNCH_ELIGIBLE` or similar (varies by CCD file version).
- **ENGLISH_LEARNERS:** Count of English learners (ESL/ELL students). From CCD field `ENGLISH_LEARNERS` or similar.
- **LEA_TYPE:** NCES LEA type code (integer, 1–8). Type 7 = charter agency. From CCD LEA file.

**Example rows:**
```
0100001,Autauga County Board of Education,AL,21,5200,2100,180,1
0600001,Los Angeles Unified School District,CA,11,430000,344000,86000,1
0999999,Sample Charter Network,CO,21,4200,1596,462,7
```

### Step 3: Place CSV and Run Import

1. Save the prepared CSV to the app directory:
   ```bash
   cp nces_2223_unified.csv app/data/nces_2223_unified.csv
   ```

2. Run the import script:
   ```bash
   cd app
   pnpm run import:nces
   ```

   Or via Makefile (if configured):
   ```bash
   make import-nces
   ```

The import script reads the CSV, derives computed fields (`urbanicity`, `sizeBucket`), normalizes FRL% and ELL%, and upserts all districts into the database.

## Column Mapping

The CSV columns map to the District Prisma model as follows:

| CSV Column | District Field | Type | Notes |
|------------|---|---|---|
| LEAID | ncesId | String | 7-digit identifier; unique constraint |
| LEA_NAME | name | String | District/LEA legal name |
| STATE_ABBR | state | String | 2-letter postal code |
| LOCALE | localeCode | String | 2-digit NCES code; used to derive urbanicity |
| TOTAL | totalEnrollment | Int | Total student count; used to derive sizeBucket |
| FREE_REDUCED_LUNCH_ELIGIBLE | (computed) | — | Count used to compute frlPct |
| ENGLISH_LEARNERS | (computed) | — | Count used to compute ellPct |
| LEA_TYPE | isCharterAgency | Boolean | True if LEA_TYPE == 7; null if unknown |

**Derived Fields (computed by import script):**

| Field | Derivation | Notes |
|---|---|---|
| urbanicity | From localeCode | Enum: "urban" (11–12), "suburban" (21–22), "town" (31–33), "rural" (41–43) |
| sizeBucket | From totalEnrollment | Enum: "very_small" (<500), "small" (500–5K), "medium" (5K–30K), "large" (30K–100K), "very_large" (>100K) |
| frlPct | (FREE_REDUCED_LUNCH_ELIGIBLE / TOTAL) × 100 | Percentage, rounded to 1 decimal. Null if TOTAL is 0 or missing. |
| ellPct | (ENGLISH_LEARNERS / TOTAL) × 100 | Percentage, rounded to 1 decimal. Null if TOTAL is 0 or missing. |

## Handling Missing and Suppressed Data

NCES masks (suppresses) demographic data for small districts to protect privacy. The CSV may contain empty cells or special codes for suppressed values.

### Suppression Rules

- **Empty cell or blank:** Treat as null.
- **-1, -2, -9, or other negative values:** Treat as null (NCES standard codes for "not applicable," "withheld," "not reported").
- **0 in FRL/ELL counts with non-zero TOTAL:** May indicate truly zero students in that category. Accept as 0%.
- **0 in TOTAL enrollment:** Treat entire row as invalid (skip or flag for manual review).

### Null Handling in Database

When a value is null or suppressed:

- **localeCode:** Stored as null. Matching algorithm handles null gracefully.
- **frlPct:** Stored as null. Matching uses NULL-safe comparison (treats null as neutral, neither penalizing nor rewarding).
- **ellPct:** Stored as null. Same as frlPct.
- **totalEnrollment:** If null, sizeBucket is also null.
- **isCharterAgency:** If LEA_TYPE is unknown or missing, stored as null (distinct from false).

The matching engine does not penalize districts with null demographic data — nulls are ignored in scoring, not treated as zero.

## Quality Checks

Before importing, verify:

1. **CSV Structure:** Exactly 8 columns, correct headers (case-sensitive).
2. **LEAID Uniqueness:** No duplicate LEA IDs in the CSV.
3. **Data Types:**
   - LEAID: 7 numeric digits
   - TOTAL, FREE_REDUCED_LUNCH_ELIGIBLE, ENGLISH_LEARNERS: Non-negative integers (or empty)
   - LOCALE: 2-digit numeric code
   - STATE_ABBR: Valid US postal abbreviation
   - LEA_TYPE: 1–8 (integer)
4. **Enrollment Sanity:** TOTAL >= FREE_REDUCED_LUNCH_ELIGIBLE and TOTAL >= ENGLISH_LEARNERS (when both are present).

## Troubleshooting

- **Import script fails with "duplicate ncesId":** Two or more LEAs in the CSV have the same LEAID. Check the CCD source files for errors or stale data.
- **Districts with null urbanicity or sizeBucket:** Check that localeCode and totalEnrollment are not null. These are required for derivation.
- **Matching produces no results:** Verify at least one district has matching problem statements selected by users. Check that demographic data (especially frlPct, ellPct, urbanicity) is not entirely null.
- **FRL% or ELL% appears 0% when expected higher:** Verify the count columns in the CSV correspond to the correct school year. NCES may report different fiscal vs. academic year counts.

## Re-import and Updates

The import script uses `upsert` (update-or-insert) based on ncesId:
- Existing districts with matching ncesId are updated.
- New districts are inserted.
- No districts are deleted during import.

To reset to a known state:

```bash
make db-reset  # Drops, recreates, migrates, and seeds with sample data
```

Then re-run the NCES import:

```bash
make import-nces
```

This ensures sample data is refreshed and all NCES districts are loaded.

## Example CSV Structure

A complete example of the expected CSV format:

```
LEAID,LEA_NAME,STATE_ABBR,LOCALE,TOTAL,FREE_REDUCED_LUNCH_ELIGIBLE,ENGLISH_LEARNERS,LEA_TYPE
0100001,Autauga County Board of Education,AL,21,5200,2100,180,1
0100002,Baldwin County Board of Education,AL,21,15300,6800,420,1
0600001,Los Angeles Unified School District,CA,11,430000,344000,86000,1
1700001,Springfield SD 186,IL,12,14000,9590,728,1
4800001,Dripping Springs ISD,TX,21,7500,615,337,1
2900001,Macon County R-1,MO,43,1800,990,37,1
0999999,Sample Charter Network,CO,21,4200,1596,462,7
```

Notes:
- Row 1 (Autauga, AL) has a suburban locale (21), large enrollment, and moderate FRL%.
- Row 3 (LAUSD, CA) is urban (11), very large, and very high FRL% and ELL%.
- Row 7 (Sample Charter) has LEA_TYPE = 7 (charter), so isCharterAgency = true.

## References

- NCES Common Core of Data: https://nces.ed.gov/ccd/
- 2022–23 CCD Public Use Files: https://nces.ed.gov/pubsearch/pubsinfo.asp?pubid=2024040
- NCES Locale Codes: https://nces.ed.gov/pubs2006/006 (appendix; or see field documentation in CCD data dictionary)
- Matching Algorithm: See `docs/implementation-plan.md` section on matching rules.
