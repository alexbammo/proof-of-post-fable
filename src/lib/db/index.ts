import * as schema from "./schema";
import type { PgDatabase } from "drizzle-orm/pg-core";

// One Drizzle pg-core schema, two drivers:
//  - DATABASE_URL set   -> node-postgres (Render Postgres in production)
//  - DATABASE_URL empty -> embedded PGlite file under ./data/pglite (local dev, zero setup)
// Both speak Postgres, so migrations and queries are identical.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;

const globalForDb = globalThis as unknown as { __db?: Promise<Db> };

async function create(): Promise<Db> {
  const url = process.env.DATABASE_URL;
  const folder = "./drizzle";
  if (url) {
    const { drizzle } = await import("drizzle-orm/node-postgres");
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { Pool } = await import("pg");
    const pool = new Pool({
      connectionString: url,
      ssl: url.includes("render.com") ? { rejectUnauthorized: false } : undefined,
    });
    const db = drizzle(pool, { schema });
    await migrate(db, { migrationsFolder: folder });
    return db as unknown as Db;
  }
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const { PGlite } = await import("@electric-sql/pglite");
  const client = new PGlite("./data/pglite");
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: folder });
  return db as unknown as Db;
}

export function getDb(): Promise<Db> {
  if (!globalForDb.__db) globalForDb.__db = create();
  return globalForDb.__db;
}

export { schema };
