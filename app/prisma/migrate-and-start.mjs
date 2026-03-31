import { execSync } from "node:child_process";
import { spawn } from "node:child_process";

try {
  console.log("Running prisma migrate deploy...");
  execSync("prisma migrate deploy --config=prisma/deploy.config.js", {
    stdio: "inherit",
    env: process.env,
  });
  console.log("Migrations complete.");
} catch (e) {
  console.error("Migration failed:", e.message);
  process.exit(1);
}

/**
 * One-time (or rare) production bootstrap: bulk NCES districts from bundled CSV,
 * then problem statements via seed. Set BOOTSTRAP_NCES_ON_START=1 on Railway for
 * the first deploy, then remove it so later restarts skip the import (~18k rows).
 */
if (process.env.BOOTSTRAP_NCES_ON_START === "1") {
  console.log(
    "BOOTSTRAP_NCES_ON_START=1: NCES import + seed (unset this var after first successful run)",
  );
  try {
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
  } catch (e) {
    console.error("Bootstrap failed:", e.message);
    process.exit(1);
  }
}

console.log("Starting server...");
const server = spawn("node", ["server.js"], {
  stdio: "inherit",
  env: process.env,
});
server.on("exit", (code) => process.exit(code ?? 1));
