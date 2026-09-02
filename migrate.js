import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const MIGRATION_LOCK_ID = 7_431_920_116;

export async function runMigrations(databaseUrl) {
  const sql = postgres(databaseUrl, { max: 1, connect_timeout: 15 });
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `;
    const directory = resolve("migrations");
    const files = (await readdir(directory)).filter((name) => /^\d+.*\.sql$/.test(name)).sort();
    for (const name of files) {
      const source = await readFile(resolve(directory, name), "utf8");
      const checksum = createHash("sha256").update(source).digest("hex");
      const body = source.replace(/^\s*BEGIN;\s*/i, "").replace(/\s*COMMIT;\s*$/i, "");
      await sql.begin(async (transaction) => {
        // Transaction-scoped locks are safe with PgBouncer/Neon pooled URLs.
        await transaction`SELECT pg_advisory_xact_lock(${MIGRATION_LOCK_ID})`;
        const rows = await transaction`SELECT checksum FROM schema_migrations WHERE name = ${name}`;
        const previous = rows[0]?.checksum;
        if (previous === checksum) return;
        if (previous !== undefined) throw new Error(`Migration ${name} changed after it was applied`);
        await transaction.unsafe(body);
        await transaction`INSERT INTO schema_migrations (name, checksum) VALUES (${name}, ${checksum})`;
        console.log(`Applied migration ${name}`);
      });
    }
  } finally {
    await sql.end();
  }
}
