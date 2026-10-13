import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type Database = NodePgDatabase<typeof schema>;

type DatabaseGlobals = typeof globalThis & {
  __storeDemoPgPool?: Pool;
  __storeDemoDb?: Database;
};

const globalForDb = globalThis as DatabaseGlobals;

function resolveConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.local and add your Prisma Postgres connection string.",
    );
  }

  return connectionString;
}

/**
 * Lazily create (and reuse) the Drizzle client.
 *
 * The pool is cached on `globalThis` so Fast Refresh in development does not
 * leak a new connection pool per reload, and `DATABASE_URL` is only read on
 * first use so importing this module can never break `next build`.
 */
export function getDb(): Database {
  if (globalForDb.__storeDemoDb) {
    return globalForDb.__storeDemoDb;
  }

  const pool = globalForDb.__storeDemoPgPool ?? new Pool({ connectionString: resolveConnectionString() });
  const db = drizzle(pool, { schema });

  globalForDb.__storeDemoPgPool = pool;
  globalForDb.__storeDemoDb = db;

  return db;
}
