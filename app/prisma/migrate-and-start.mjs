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

console.log("Starting server...");
const server = spawn("node", ["server.js"], {
  stdio: "inherit",
  env: process.env,
});
server.on("exit", (code) => process.exit(code ?? 1));
