import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = await readFile(resolve(process.cwd(), "db/schema.sql"), "utf8");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_URL.includes("localhost") ? false : { rejectUnauthorized: false } });
await client.connect();
try {
  await client.query(sql);
  console.log("FieldBrief database schema is ready.");
} finally {
  await client.end();
}
