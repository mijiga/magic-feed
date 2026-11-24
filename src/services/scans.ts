import { createHash, randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events, scans, sources } from "../db/schema.js";
import type { Scan, ScanBatchInput, ScanBatchResult, Source } from "../domain/types.js";
import { badRequest, notFound } from "./errors.js";

type ScanRow = typeof scans.$inferSelect;

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value ?? null);
}

export const contentHash = (raw: unknown) => createHash("sha256").update(stableStringify(raw)).digest("hex");

export function listSources(db: Db): Source[] {
  return db.select().from(sources).orderBy(asc(sources.id)).all();
}

export function ingestScans(db: Db, input: ScanBatchInput): ScanBatchResult {
  const source = db.select().from(sources).where(eq(sources.id, input.source_id)).get();
  if (!source) {
    throw badRequest(`Unknown source_id '${input.source_id}'`, { allowed: listSources(db).map((s) => s.id) });
  }
  const now = new Date().toISOString();

  return db.transaction((tx) => {
    const results: ScanBatchResult["results"] = [];
    for (const item of input.items) {
      const hash = contentHash(item.raw);
      const same = tx
        .select()
        .from(scans)
        .where(and(eq(scans.source_id, source.id), eq(scans.external_id, item.external_id), eq(scans.content_hash, hash)))
        .get();
      if (same) {
        tx.update(scans).set({ last_seen_at: now }).where(eq(scans.id, same.id)).run();
        if (same.event_id) tx.update(events).set({ last_checked: now }).where(eq(events.id, same.event_id)).run();
        results.push({ external_id: item.external_id, scan_id: same.id, outcome: "unchanged" });
        continue;
      }
      const known = tx
        .select({ id: scans.id })
        .from(scans)
        .where(and(eq(scans.source_id, source.id), eq(scans.external_id, item.external_id)))
        .get();
      const id = randomUUID();
      tx.insert(scans)
        .values({
          id,
          source_id: source.id,
          external_id: item.external_id,
          url: item.url,
          raw: item.raw ?? null,
          content_hash: hash,
          state: "pending",
          event_id: null,
          note: null,
          fetched_at: now,
          last_seen_at: now,
          processed_at: null,
        })
        .run();
      results.push({ external_id: item.external_id, scan_id: id, outcome: known ? "changed" : "created" });
    }
    return { results };
  });
}

function previousEventId(db: Db, row: ScanRow): string | null {
  const prev = db
    .select({ event_id: scans.event_id })
    .from(scans)
    .where(
      and(
        eq(scans.source_id, row.source_id),
        eq(scans.external_id, row.external_id),
        ne(scans.id, row.id),
        isNotNull(scans.event_id),
      ),
    )
    .orderBy(desc(scans.fetched_at), desc(sql`rowid`))
    .get();
  return prev?.event_id ?? null;
}

const toScan = (db: Db, row: ScanRow): Scan => ({ ...row, previous_event_id: previousEventId(db, row) });

export function listScans(
  db: Db,
  q: { state?: Scan["state"]; source_id?: string; limit: number },
): { count: number; scans: Scan[] } {
  const where = and(
    q.state ? eq(scans.state, q.state) : undefined,
    q.source_id ? eq(scans.source_id, q.source_id) : undefined,
  );
  const rows = db.select().from(scans).where(where).orderBy(asc(scans.fetched_at), asc(sql`rowid`)).limit(q.limit).all();
  const list = rows.map((r) => toScan(db, r));
  return { count: list.length, scans: list };
}

export function getScan(db: Db, id: string): Scan {
  const row = db.select().from(scans).where(eq(scans.id, id)).get();
  if (!row) throw notFound(`Scan '${id}' not found`);
  return toScan(db, row);
}

export function ignoreScan(db: Db, id: string, reason: string): Scan {
  getScan(db, id);
  db.update(scans)
    .set({ state: "ignored", note: reason, processed_at: new Date().toISOString() })
    .where(eq(scans.id, id))
    .run();
  return getScan(db, id);
}
