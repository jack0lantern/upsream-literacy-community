import path from "node:path";
import { defineConfig } from "prisma/config";

// Minimal config for `prisma migrate deploy` in production.
// Reads DATABASE_URL directly from the environment (no dotenv needed).
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is required");
}

export default defineConfig({
  schema: path.join(__dirname, "schema.prisma"),
  datasource: {
    url: databaseUrl,
  },
});
