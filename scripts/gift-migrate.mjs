import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import pg from "pg";

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const migrationsDirectory = join(scriptDirectory, "..", "db", "migrations");
const pool = new Pool({ connectionString, max: 1 });

try {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "gift-schema-migrations" (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const applied = await client.query(
        'SELECT 1 FROM "gift-schema-migrations" WHERE name = $1',
        [file],
      );
      if (applied.rowCount) {
        console.log(`Gift migration already applied: ${file}`);
        continue;
      }

      const sql = await readFile(join(migrationsDirectory, file), "utf8");
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO "gift-schema-migrations" (name) VALUES ($1)',
          [file],
        );
        await client.query("COMMIT");
        console.log(`Applied Gift migration: ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
} finally {
  await pool.end();
}
