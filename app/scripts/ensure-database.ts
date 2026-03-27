import { config } from "dotenv";
import { resolve } from "node:path";
import pg from "pg";
import {
  defaultShadowDatabaseUrl,
  maintenanceDatabaseUrl,
  parseDatabaseName,
} from "../prisma/connection-helpers";

config({ path: resolve(process.cwd(), ".env") });
config({ path: resolve(process.cwd(), ".env.local"), override: true });

const rawDatabaseUrl = process.env.DATABASE_URL;
if (!rawDatabaseUrl) {
  console.error(
    "DATABASE_URL is not set. Add it to .env or .env.local in the app directory.",
  );
  process.exit(1);
}
const databaseUrl = rawDatabaseUrl;

async function ensureDatabaseExists(
  client: pg.Client,
  dbName: string,
): Promise<void> {
  const { rows } = await client.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
    [dbName],
  );
  if (rows[0]?.exists) {
    console.log(`Database "${dbName}" already exists.`);
    return;
  }
  await client.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
  console.log(`Created database "${dbName}".`);
}

async function ensureOnServer(adminUrl: string, dbNames: string[]): Promise<void> {
  const client = new pg.Client({ connectionString: adminUrl });
  await client.connect();
  try {
    for (const name of dbNames) {
      await ensureDatabaseExists(client, name);
    }
  } finally {
    await client.end();
  }
}

async function main() {
  const mainName = parseDatabaseName(databaseUrl);
  const shadowUrl =
    process.env.SHADOW_DATABASE_URL ?? defaultShadowDatabaseUrl(databaseUrl);
  const shadowName = parseDatabaseName(shadowUrl);

  const mainAdmin = maintenanceDatabaseUrl(databaseUrl);
  const shadowAdmin = maintenanceDatabaseUrl(shadowUrl);

  if (mainAdmin === shadowAdmin) {
    await ensureOnServer(mainAdmin, [mainName, shadowName]);
  } else {
    await ensureOnServer(mainAdmin, [mainName]);
    console.log(
      `Ensuring shadow database on other host (from SHADOW_DATABASE_URL)...`,
    );
    await ensureOnServer(shadowAdmin, [shadowName]);
  }
}

main().catch((err) => {
  console.error("ensure-database failed:", err);
  process.exit(1);
});
