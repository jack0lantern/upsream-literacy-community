import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";
import { defaultShadowDatabaseUrl } from "./prisma/connection-helpers";

// Honor DATABASE_URL / SHADOW_DATABASE_URL already set in the environment (CI, shell)
// before .env.local — override: true would otherwise replace them.
const preservedDatabaseUrl = process.env.DATABASE_URL;
const preservedShadowDatabaseUrl = process.env.SHADOW_DATABASE_URL;

config({ path: path.join(__dirname, ".env") });
config({ path: path.join(__dirname, ".env.local"), override: true });

if (preservedDatabaseUrl !== undefined) {
  process.env.DATABASE_URL = preservedDatabaseUrl;
}
if (preservedShadowDatabaseUrl !== undefined) {
  process.env.SHADOW_DATABASE_URL = preservedShadowDatabaseUrl;
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is required for Prisma CLI. Set it in .env or .env.local.",
  );
}

const shadowDatabaseUrl =
  process.env.SHADOW_DATABASE_URL ?? defaultShadowDatabaseUrl(databaseUrl);

export default defineConfig({
  schema: path.join(__dirname, "prisma", "schema.prisma"),
  datasource: {
    url: databaseUrl,
    // Avoid P1010 when the DB role cannot CREATE DATABASE (migrate dev shadow).
    shadowDatabaseUrl,
  },
});
