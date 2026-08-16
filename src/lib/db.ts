import pg from "pg";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var fieldbriefPool: pg.Pool | undefined;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool(): pg.Pool {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!global.fieldbriefPool) {
    global.fieldbriefPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false },
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
    });
  }
  return global.fieldbriefPool;
}

export async function query<T extends pg.QueryResultRow>(text: string, values: unknown[] = []) {
  return getPool().query<T>(text, values);
}
