import { existsSync } from "node:fs";

import { defineConfig } from "drizzle-kit";

// `drizzle-kit` only auto-loads `.env`, while Next.js reads `.env.local` first.
// Load it explicitly so both tools share a single source of truth.
for (const envFile of [".env.local", ".env"]) {
  if (existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is missing. Copy .env.example to .env.local and add your Prisma Postgres connection string.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./lib/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
});
