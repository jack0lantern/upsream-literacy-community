/** Pure helpers for DATABASE_URL / shadow DB — shared by prisma.config.ts and ensure-database. */

export function parseDatabaseName(urlString: string): string {
  const url = new URL(urlString);
  const name = url.pathname.replace(/^\//, "").split("/")[0]?.trim();
  if (!name) {
    throw new Error("Database URL must include a database name in the path.");
  }
  return name;
}

export function withDatabaseName(urlString: string, dbName: string): string {
  const url = new URL(urlString);
  url.pathname = `/${dbName}`;
  return url.toString();
}

/** Prisma Migrate shadow DB on the same cluster as `mainDatabaseUrl`. */
export function defaultShadowDatabaseUrl(mainDatabaseUrl: string): string {
  const mainName = parseDatabaseName(mainDatabaseUrl);
  return withDatabaseName(mainDatabaseUrl, `${mainName}_shadow`);
}

export function maintenanceDatabaseUrl(appDatabaseUrl: string): string {
  const url = new URL(appDatabaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}
