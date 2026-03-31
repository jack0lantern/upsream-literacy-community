/**
 * Production bootstrap: if the districts table is empty, run NCES import + seed.
 * Called from prisma/migrate-and-start.mjs on every container start; no-ops in O(1)
 * when data already exists (typical restarts and deploys).
 */
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  if (!process.env.DATABASE_URL) {
    const { config } = await import("dotenv");
    config({ path: resolve(process.cwd(), ".env") });
    config({ path: resolve(process.cwd(), ".env.local"), override: true });
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    const count = await prisma.district.count();
    if (count > 0) {
      console.log(`District data present (${count} rows); skipping NCES bootstrap.`);
      return;
    }

    console.log(
      "No districts in database; running bundled NCES import + problem seed...",
    );
    execSync("tsx scripts/import-nces-districts.ts", {
      stdio: "inherit",
      env: process.env,
    });
    execSync("tsx scripts/seed.ts", {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? "production",
      },
    });
    console.log("NCES bootstrap complete.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error("ensure-districts failed:", e);
  process.exit(1);
});
