import { config } from "dotenv";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Match Next.js load order so seed hits the same DB as the dev server
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

const PROBLEM_STATEMENTS = [
  // Category 1: Curriculum & Instruction
  {
    label: "Adopting a new core reading/ELA curriculum",
    category: "Curriculum & Instruction",
    sortOrder: 1,
  },
  {
    label: "Implementing Science of Reading practices",
    category: "Curriculum & Instruction",
    sortOrder: 2,
  },
  {
    label: "Aligning literacy instruction across grade bands",
    category: "Curriculum & Instruction",
    sortOrder: 3,
  },
  {
    label: "Building knowledge-rich content into ELA",
    category: "Curriculum & Instruction",
    sortOrder: 4,
  },
  // Category 2: Assessment & Data
  {
    label: "Selecting or implementing a universal literacy screener",
    category: "Assessment & Data",
    sortOrder: 5,
  },
  {
    label: "Using data to drive intervention placement",
    category: "Assessment & Data",
    sortOrder: 6,
  },
  {
    label: "Implementing dyslexia screening mandates",
    category: "Assessment & Data",
    sortOrder: 7,
  },
  {
    label: "Building a coherent assessment system",
    category: "Assessment & Data",
    sortOrder: 8,
  },
  // Category 3: Intervention & MTSS
  {
    label: "Designing or improving an MTSS framework for literacy",
    category: "Intervention & MTSS",
    sortOrder: 9,
  },
  {
    label: "Selecting and managing intervention programs",
    category: "Intervention & MTSS",
    sortOrder: 10,
  },
  {
    label: "Ensuring intervention fidelity across schools",
    category: "Intervention & MTSS",
    sortOrder: 11,
  },
  // Category 4: Professional Development & Coaching
  {
    label: "Retraining teachers in evidence-based literacy practices",
    category: "Professional Development & Coaching",
    sortOrder: 12,
  },
  {
    label: "Building a literacy coaching model",
    category: "Professional Development & Coaching",
    sortOrder: 13,
  },
  {
    label: "Sustaining job-embedded professional learning",
    category: "Professional Development & Coaching",
    sortOrder: 14,
  },
  // Category 5: Staffing & Leadership
  {
    label: "Recruiting and retaining reading specialists",
    category: "Staffing & Leadership",
    sortOrder: 15,
  },
  {
    label: "Maintaining initiative continuity through leadership turnover",
    category: "Staffing & Leadership",
    sortOrder: 16,
  },
  {
    label: "Building principal buy-in for literacy initiatives",
    category: "Staffing & Leadership",
    sortOrder: 17,
  },
  // Category 6: Equity & Special Populations
  {
    label: "Supporting English Language Learners in literacy",
    category: "Equity & Special Populations",
    sortOrder: 18,
  },
  {
    label: "Closing literacy gaps for high-poverty populations",
    category: "Equity & Special Populations",
    sortOrder: 19,
  },
  // Category 7: Policy & Compliance
  {
    label: "Navigating state Science of Reading mandates",
    category: "Policy & Compliance",
    sortOrder: 20,
  },
];

// Sample districts for development (representative spread).
// These use real NCES LEA IDs from the 2022-23 CCD so they align with the
// NCES import. The synthetic charter entry (0999999) is dev-only.
// Only seeded when SEED_SAMPLE_DISTRICTS=1 (e.g. CI smoke tests without a
// full NCES import). In normal dev/prod, districts come from the NCES import.
const SAMPLE_DISTRICTS = [
  {
    ncesId: "0100390",
    name: "Jefferson County Schools",
    state: "AL",
    localeCode: "21",
    urbanicity: "suburban" as const,
    totalEnrollment: 35000,
    sizeBucket: "large" as const,
    frlPct: 52.3,
    ellPct: 8.1,
    isCharterAgency: false,
  },
  {
    ncesId: "0622710",
    name: "Los Angeles Unified",
    state: "CA",
    localeCode: "11",
    urbanicity: "urban" as const,
    totalEnrollment: 430000,
    sizeBucket: "very_large" as const,
    frlPct: 80.3,
    ellPct: 20.1,
    isCharterAgency: false,
  },
  {
    ncesId: "3620580",
    name: "New York City DOE",
    state: "NY",
    localeCode: "11",
    urbanicity: "urban" as const,
    totalEnrollment: 955000,
    sizeBucket: "very_large" as const,
    frlPct: 73.0,
    ellPct: 14.8,
    isCharterAgency: false,
  },
  {
    ncesId: "1739270",
    name: "Springfield SD 186",
    state: "IL",
    localeCode: "12",
    urbanicity: "urban" as const,
    totalEnrollment: 14000,
    sizeBucket: "medium" as const,
    frlPct: 68.5,
    ellPct: 5.2,
    isCharterAgency: false,
  },
  {
    ncesId: "4813440",
    name: "Dripping Springs ISD",
    state: "TX",
    localeCode: "21",
    urbanicity: "suburban" as const,
    totalEnrollment: 7500,
    sizeBucket: "medium" as const,
    frlPct: 8.2,
    ellPct: 4.5,
    isCharterAgency: false,
  },
  {
    ncesId: "2923820",
    name: "Macon County R-1",
    state: "MO",
    localeCode: "43",
    urbanicity: "rural" as const,
    totalEnrollment: 1800,
    sizeBucket: "small" as const,
    frlPct: 55.0,
    ellPct: 2.1,
    isCharterAgency: false,
  },
  {
    ncesId: "2000030",
    name: "Abilene USD 435",
    state: "KS",
    localeCode: "33",
    urbanicity: "town" as const,
    totalEnrollment: 1200,
    sizeBucket: "small" as const,
    frlPct: 45.0,
    ellPct: 6.0,
    isCharterAgency: false,
  },
  {
    ncesId: "0804020",
    name: "Douglas County School District",
    state: "CO",
    localeCode: "21",
    urbanicity: "suburban" as const,
    totalEnrollment: 67000,
    sizeBucket: "very_large" as const,
    frlPct: 12.8,
    ellPct: 5.3,
    isCharterAgency: false,
  },
  {
    ncesId: "1200870",
    name: "Hillsborough County Public Schools",
    state: "FL",
    localeCode: "11",
    urbanicity: "urban" as const,
    totalEnrollment: 220000,
    sizeBucket: "very_large" as const,
    frlPct: 58.2,
    ellPct: 15.4,
    isCharterAgency: false,
  },
  {
    ncesId: "4218990",
    name: "Philadelphia City SD",
    state: "PA",
    localeCode: "11",
    urbanicity: "urban" as const,
    totalEnrollment: 120000,
    sizeBucket: "very_large" as const,
    frlPct: 77.0,
    ellPct: 10.9,
    isCharterAgency: false,
  },
  {
    ncesId: "2707410",
    name: "Rosemount-Apple Valley-Eagan",
    state: "MN",
    localeCode: "21",
    urbanicity: "suburban" as const,
    totalEnrollment: 28000,
    sizeBucket: "large" as const,
    frlPct: 22.5,
    ellPct: 9.3,
    isCharterAgency: false,
  },
  {
    ncesId: "5500060",
    name: "Ashland School District",
    state: "WI",
    localeCode: "33",
    urbanicity: "town" as const,
    totalEnrollment: 2100,
    sizeBucket: "small" as const,
    frlPct: 48.5,
    ellPct: 3.2,
    isCharterAgency: false,
  },
  // Synthetic NCES id for dev — represents a charter LEA (NCES agency type 7)
  {
    ncesId: "0999999",
    name: "Sample Charter School District",
    state: "CO",
    localeCode: "21",
    urbanicity: "suburban" as const,
    totalEnrollment: 4200,
    sizeBucket: "medium" as const,
    frlPct: 38.0,
    ellPct: 11.0,
    isCharterAgency: true,
  },
];

async function main() {
  console.log("🌱 Seeding database...\n");

  // Seed problem statements
  console.log("📋 Seeding problem statements...");
  for (const ps of PROBLEM_STATEMENTS) {
    await prisma.problemStatement.upsert({
      where: { id: `ps_${ps.sortOrder}` },
      update: { ...ps },
      create: { id: `ps_${ps.sortOrder}`, ...ps },
    });
  }
  console.log(`   ✓ ${PROBLEM_STATEMENTS.length} problem statements seeded\n`);

  // Seed sample districts (only when explicitly requested, e.g. CI smoke tests)
  if (process.env.SEED_SAMPLE_DISTRICTS === "1") {
    console.log("🏫 Seeding sample districts (SEED_SAMPLE_DISTRICTS=1)...");
    for (const d of SAMPLE_DISTRICTS) {
      await prisma.district.upsert({
        where: { ncesId: d.ncesId },
        update: d,
        create: d,
      });
    }
    console.log(`   ✓ ${SAMPLE_DISTRICTS.length} sample districts seeded\n`);
  }

  // Create dev users (admin + 16 test accounts)
  if (process.env.NODE_ENV !== "production") {
    const { hash } = await import("bcryptjs");
    const pwHash = await hash("password123", 12);
    const adminPwHash = await hash("admin123", 12);

    // Assign admin to Springfield SD 186 so matching works out of the box
    const adminDistrict = await prisma.district.findUnique({
      where: { ncesId: "1739270" },
    });

    console.log("👤 Creating dev admin user...");
    const adminUser = await prisma.user.upsert({
      where: { email: "admin@upstream.dev" },
      update: {
        passwordHash: adminPwHash,
        name: "Admin User",
        isAdmin: true,
        emailVerified: true,
        onboarded: true,
        status: "active",
        districtId: adminDistrict?.id ?? null,
        role: "literacy_director",
      },
      create: {
        email: "admin@upstream.dev",
        passwordHash: adminPwHash,
        name: "Admin User",
        isAdmin: true,
        emailVerified: true,
        onboarded: true,
        status: "active",
        districtId: adminDistrict?.id ?? null,
        role: "literacy_director",
      },
    });

    // Give admin some problem statements so the matching algorithm scores peers
    for (const sortOrder of [2, 9, 19]) {
      await prisma.userProblem.upsert({
        where: {
          userId_problemId: { userId: adminUser.id, problemId: `ps_${sortOrder}` },
        },
        update: {},
        create: { userId: adminUser.id, problemId: `ps_${sortOrder}` },
      });
    }
    console.log("   ✓ Admin: admin@upstream.dev / admin123");

    // Look up districts by ncesId directly from the DB (populated by NCES import
    // or by SAMPLE_DISTRICTS when SEED_SAMPLE_DISTRICTS=1)
    const ncesIdsNeeded = [
      "0100390", // Jefferson County Schools, AL
      "0622710", // Los Angeles Unified, CA
      "3620580", // New York City DOE, NY
      "1739270", // Springfield SD 186, IL
      "4813440", // Dripping Springs ISD, TX
      "2923820", // Macon County R-1, MO
      "2000030", // Abilene USD 435, KS
      "0804020", // Douglas County SD, CO
      "1200870", // Hillsborough County PS, FL
      "4218990", // Philadelphia City SD, PA
      "2707410", // Rosemount-Apple Valley-Eagan, MN
      "5500060", // Ashland School District, WI
      "0999999", // Sample Charter (dev-only)
    ];
    const districtsByNces = new Map<string, string>();
    for (const ncesId of ncesIdsNeeded) {
      const found = await prisma.district.findUnique({ where: { ncesId } });
      if (found) districtsByNces.set(ncesId, found.id);
    }

    // 16 seed users — spread across districts, roles, urbanicities, and sizes
    const SEED_USERS: {
      email: string;
      name: string;
      role: "literacy_director" | "curriculum_coordinator" | "literacy_coach" | "mtss_coordinator" | "other";
      districtNcesId: string;
      bio: string;
      problemSortOrders: number[];
    }[] = [
      {
        email: "maria.santos@jefferson.edu",
        name: "Maria Santos",
        role: "literacy_director",
        districtNcesId: "0100390", // Jefferson County, AL — suburban, large
        bio: "15 years in literacy leadership. Focused on SoR implementation across 40+ schools.",
        problemSortOrders: [2, 12, 14],
      },
      {
        email: "james.oconnor@lausd.edu",
        name: "James O'Connor",
        role: "curriculum_coordinator",
        districtNcesId: "0622710", // LA Unified, CA — urban, very_large
        bio: "Coordinating ELA curriculum adoption for the nation's second-largest district.",
        problemSortOrders: [1, 4, 18],
      },
      {
        email: "priya.patel@nycdoe.edu",
        name: "Priya Patel",
        role: "mtss_coordinator",
        districtNcesId: "3620580", // NYC DOE, NY — urban, very_large
        bio: "Building MTSS frameworks that serve nearly a million students across five boroughs.",
        problemSortOrders: [9, 10, 6],
      },
      {
        email: "derek.washington@springfield186.edu",
        name: "Derek Washington",
        role: "literacy_coach",
        districtNcesId: "1739270", // Springfield SD 186, IL — urban, medium
        bio: "Former reading specialist turned coach. Passionate about closing equity gaps.",
        problemSortOrders: [19, 12, 11],
      },
      {
        email: "sarah.chen@dsisd.edu",
        name: "Sarah Chen",
        role: "literacy_director",
        districtNcesId: "4813440", // Dripping Springs ISD, TX — suburban, medium
        bio: "Leading literacy strategy in a fast-growing suburban district.",
        problemSortOrders: [1, 3, 5],
      },
      {
        email: "tom.redcloud@macon.k12.mo.us",
        name: "Tom Redcloud",
        role: "other",
        districtNcesId: "2923820", // Macon County R-1, MO — rural, small
        bio: "Superintendent wearing many hats in a small rural district. Literacy is priority #1.",
        problemSortOrders: [15, 16, 2],
      },
      {
        email: "lisa.martinez@usd435.edu",
        name: "Lisa Martinez",
        role: "literacy_coach",
        districtNcesId: "2000030", // Abilene USD 435, KS — town, small
        bio: "Only literacy coach in the district. Supporting K-8 teachers across 3 buildings.",
        problemSortOrders: [13, 14, 7],
      },
      {
        email: "kevin.nguyen@dcsdk12.edu",
        name: "Kevin Nguyen",
        role: "curriculum_coordinator",
        districtNcesId: "0804020", // Douglas County, CO — suburban, very_large
        bio: "Aligning curriculum K-12 in a high-performing suburban district.",
        problemSortOrders: [3, 4, 8],
      },
      {
        email: "angela.brooks@hcps.edu",
        name: "Angela Brooks",
        role: "mtss_coordinator",
        districtNcesId: "1200870", // Hillsborough County, FL — urban, very_large
        bio: "Designing intervention systems for 220k students with diverse needs.",
        problemSortOrders: [9, 10, 7],
      },
      {
        email: "robert.kim@philasd.edu",
        name: "Robert Kim",
        role: "literacy_director",
        districtNcesId: "4218990", // Philadelphia City SD, PA — urban, very_large
        bio: "Navigating state mandates while addressing deep equity challenges.",
        problemSortOrders: [20, 19, 2],
      },
      {
        email: "jennifer.larson@district196.edu",
        name: "Jennifer Larson",
        role: "curriculum_coordinator",
        districtNcesId: "2707410", // Rosemount-Apple Valley-Eagan, MN — suburban, large
        bio: "Building knowledge-rich ELA programming in a diverse suburban district.",
        problemSortOrders: [4, 1, 18],
      },
      {
        email: "marcus.johnson@ashland.k12.wi.us",
        name: "Marcus Johnson",
        role: "literacy_coach",
        districtNcesId: "5500060", // Ashland, WI — town, small
        bio: "Supporting rural teachers with evidence-based reading instruction.",
        problemSortOrders: [12, 13, 15],
      },
      {
        email: "diana.flores@lausd.edu",
        name: "Diana Flores",
        role: "literacy_director",
        districtNcesId: "0622710", // LA Unified, CA — urban, very_large
        bio: "Focused on ELL literacy outcomes in the largest ELL-serving district in the country.",
        problemSortOrders: [18, 5, 6],
      },
      {
        email: "brian.murphy@hcps.edu",
        name: "Brian Murphy",
        role: "other",
        districtNcesId: "1200870", // Hillsborough County, FL — urban, very_large
        bio: "Assistant superintendent overseeing curriculum and instruction.",
        problemSortOrders: [17, 16, 11],
      },
      {
        email: "rachel.abrams@springfield186.edu",
        name: "Rachel Abrams",
        role: "mtss_coordinator",
        districtNcesId: "1739270", // Springfield SD 186, IL — urban, medium
        bio: "Implementing dyslexia screening and building tiered intervention supports.",
        problemSortOrders: [7, 9, 6],
      },
      {
        email: "elena.vega@samplecharter.edu",
        name: "Elena Vega",
        role: "literacy_director",
        districtNcesId: "0999999", // Sample charter LEA (dev)
        bio: "Leading literacy across a network of charter schools under one authorizer.",
        problemSortOrders: [2, 9, 20],
      },
    ];

    console.log("👥 Creating 16 seed user accounts...");
    for (const u of SEED_USERS) {
      const districtId = districtsByNces.get(u.districtNcesId) ?? null;
      const user = await prisma.user.upsert({
        where: { email: u.email },
        update: {
          passwordHash: pwHash,
          name: u.name,
          role: u.role,
          bio: u.bio,
          districtId,
          emailVerified: true,
          onboarded: true,
          status: "active",
        },
        create: {
          email: u.email,
          passwordHash: pwHash,
          name: u.name,
          role: u.role,
          bio: u.bio,
          districtId,
          emailVerified: true,
          onboarded: true,
          status: "active",
        },
      });

      // Assign problem statements
      for (const sortOrder of u.problemSortOrders) {
        await prisma.userProblem.upsert({
          where: {
            userId_problemId: { userId: user.id, problemId: `ps_${sortOrder}` },
          },
          update: {},
          create: { userId: user.id, problemId: `ps_${sortOrder}` },
        });
      }
    }
    console.log(`   ✓ ${SEED_USERS.length} user accounts seeded (password: password123)\n`);
  }

  console.log("✅ Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
