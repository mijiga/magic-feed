import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema.js";
import { APPROVED_VOCABULARY, PLACES, SOURCES } from "../domain/seed.js";
import { recheckReview } from "../services/review.js";

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type Conn = Db | Tx;

const MIGRATIONS = fileURLToPath(new URL("../../drizzle", import.meta.url));

export function openDb(path: string): Db {
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS });
  seed(db);
  recheckReview(db, "The seed vocabulary approved a term that this event uses.");
  return db;
}

// A term that an agent proposed becomes approved when the user adds it to the gold set vocabulary.
function seed(db: Db) {
  const now = new Date().toISOString();
  db.transaction((tx) => {
    for (const p of PLACES) tx.insert(schema.places).values(p).onConflictDoNothing().run();
    for (const s of SOURCES) tx.insert(schema.sources).values(s).onConflictDoNothing().run();
    for (const kind of ["category", "interests", "suitability"] as const) {
      for (const term of APPROVED_VOCABULARY[kind]) {
        tx.insert(schema.terms)
          .values({ kind, term, status: "approved", reason: "Seed vocabulary", created_at: now })
          .onConflictDoUpdate({ target: [schema.terms.kind, schema.terms.term], set: { status: "approved" } })
          .run();
      }
    }
  });
}
