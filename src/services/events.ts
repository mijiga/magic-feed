import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Conn, Db } from "../db/client.js";
import { eventChanges, events, scans, times as timesTable } from "../db/schema.js";
import {
  REVIEW_CONFIDENCE_THRESHOLD,
  type Event,
  type EventChange,
  type EventDetail,
  type EventInput,
  type EventPatch,
  type ReviewState,
  type Time,
  type TimeInput,
} from "../domain/types.js";
import { badRequest, notFound } from "./errors.js";
import { computeStatus, isUnknown, parseRrule } from "./timeline.js";
import { checkLabels, requirePlace, type LabelSet } from "./vocabulary.js";

export type EventRow = typeof events.$inferSelect;
type Actor = EventChange["actor"];

const now = () => new Date().toISOString();

export function loadTimes(db: Conn, eventId: string): Time[] {
  return db.select().from(timesTable).where(eq(timesTable.event_id, eventId)).orderBy(asc(sql`rowid`)).all();
}

function sourceUrls(db: Conn, eventId: string): string[] {
  const rows = db.select({ url: scans.url }).from(scans).where(eq(scans.event_id, eventId)).orderBy(asc(scans.fetched_at)).all();
  return [...new Set(rows.map((r) => r.url).filter((u): u is string => !!u))];
}

export function toEvent(db: Conn, row: EventRow, asOf: string, times = loadTimes(db, row.id)): Event {
  return {
    ...row,
    status: computeStatus(row.state, times, asOf),
    source_urls: sourceUrls(db, row.id),
    times,
  };
}

export function requireEvent(db: Conn, id: string): EventRow {
  const row = db.select().from(events).where(eq(events.id, id)).get();
  if (!row) throw notFound(`Event '${id}' not found`);
  return row;
}

export function listChanges(db: Conn, eventId: string): EventChange[] {
  return db
    .select()
    .from(eventChanges)
    .where(eq(eventChanges.event_id, eventId))
    .orderBy(desc(eventChanges.changed_at), desc(sql`rowid`))
    .all();
}

export function getEventDetail(db: Conn, id: string, asOf: string): EventDetail {
  const row = requireEvent(db, id);
  const scanIds = db.select({ id: scans.id }).from(scans).where(eq(scans.event_id, id)).orderBy(asc(scans.fetched_at)).all();
  return { ...toEvent(db, row, asOf), scan_ids: scanIds.map((s) => s.id), changes: listChanges(db, id) };
}

export function changesSince(db: Db, placeId: string, since: string, limit: number): EventChange[] {
  if (Number.isNaN(Date.parse(since))) throw badRequest(`since '${since}' is not an ISO date or datetime`);
  requirePlace(db, placeId);
  return db
    .select({ change: eventChanges })
    .from(eventChanges)
    .innerJoin(events, eq(events.id, eventChanges.event_id))
    .where(and(eq(events.place_id, placeId), gte(eventChanges.changed_at, since)))
    .orderBy(desc(eventChanges.changed_at), desc(sql`${eventChanges}.rowid`))
    .limit(limit)
    .all()
    .map((r) => r.change);
}

export function writeChange(
  db: Conn,
  c: { event_id: string; field: string; old_value: unknown; new_value: unknown; reason: string; actor: Actor; scan_id?: string | null },
  at = now(),
) {
  db.insert(eventChanges)
    .values({
      id: randomUUID(),
      event_id: c.event_id,
      field: c.field,
      old_value: c.old_value ?? null,
      new_value: c.new_value ?? null,
      reason: c.reason,
      actor: c.actor,
      scan_id: c.scan_id ?? null,
      changed_at: at,
    })
    .run();
}

export function reviewOutcome(
  confidence: number,
  confidenceReason: string | null,
  labelReasons: string[],
  times: TimeInput[],
): { review_state: ReviewState; review_reasons: string[] } {
  const low = confidence < REVIEW_CONFIDENCE_THRESHOLD;
  const reasons: string[] = [];
  if (low) reasons.push(`confidence ${confidence} is below ${REVIEW_CONFIDENCE_THRESHOLD}: ${confidenceReason ?? "no reason given"}`);
  reasons.push(...labelReasons);
  if (low && times.some(isUnknown)) reasons.push("a time has unknown dates and confidence is below the threshold");
  return { review_state: reasons.length ? "needs_review" : "published", review_reasons: reasons };
}

function validateTimes(times: TimeInput[]) {
  const problems: string[] = [];
  times.forEach((t, i) => {
    if (t.precision !== "unknown" && !t.start) problems.push(`times[${i}]: start is required when precision is ${t.precision}`);
    if (t.type === "recurring" && t.precision === "exact" && !t.rrule) problems.push(`times[${i}]: a recurring time needs an rrule`);
    if (t.rrule) {
      try {
        parseRrule(t.rrule);
      } catch {
        problems.push(`times[${i}]: rrule '${t.rrule}' is not valid`);
      }
    }
    if (t.start && t.end && t.end.length === t.start.length && t.end < t.start && !/^\d{2}$/.test(t.start)) {
      problems.push(`times[${i}]: end is before start`);
    }
  });
  if (problems.length) throw badRequest("Invalid times", problems);
}

function requireScans(db: Conn, ids: string[]) {
  const found = db.select({ id: scans.id }).from(scans).where(inArray(scans.id, ids)).all();
  const missing = ids.filter((id) => !found.some((f) => f.id === id));
  if (missing.length) throw badRequest("Unknown scan_ids", { unknown: missing });
}

function insertTimes(db: Conn, eventId: string, times: TimeInput[]) {
  for (const t of times) db.insert(timesTable).values({ ...t, id: randomUUID(), event_id: eventId }).run();
}

function linkScans(db: Conn, eventId: string, ids: string[], at: string) {
  if (!ids.length) return;
  db.update(scans).set({ state: "processed", event_id: eventId, processed_at: at }).where(inArray(scans.id, ids)).run();
}

export function createEvent(db: Db, input: EventInput, asOf: string): EventDetail {
  requirePlace(db, input.place_id);
  requireScans(db, input.scan_ids);
  validateTimes(input.times);
  const labelReasons = checkLabels(db, input);
  const review = reviewOutcome(input.confidence, input.confidence_reason, labelReasons, input.times);
  const at = now();
  const id = randomUUID();
  const { times, scan_ids, ...fields } = input;

  db.transaction((tx) => {
    tx.insert(events)
      .values({ ...fields, id, ...review, created_at: at, last_updated: at, last_checked: at })
      .run();
    insertTimes(tx, id, times);
    linkScans(tx, id, scan_ids, at);
    writeChange(tx, { event_id: id, field: "created", old_value: null, new_value: input, reason: "Created from scans", actor: "agent", scan_id: scan_ids[0] }, at);
  });
  return getEventDetail(db, id, asOf);
}

const SCALAR_FIELDS = [
  "name",
  "description",
  "place_id",
  "venue",
  "category",
  "interests",
  "suitability",
  "state",
  "confidence",
  "confidence_reason",
  "price",
  "booking_url",
  "ticket_sale_cutoff",
] as const;
const REVIEW_FIELDS = new Set(["category", "interests", "suitability", "confidence", "confidence_reason", "times"]);

const plainTime = (t: TimeInput): TimeInput => ({
  type: t.type,
  start: t.start,
  end: t.end,
  precision: t.precision,
  rrule: t.rrule,
  exceptions: t.exceptions,
  start_time: t.start_time,
  end_time: t.end_time,
  note: t.note,
});

export function patchEvent(db: Db, id: string, patch: EventPatch, asOf: string): EventDetail {
  const current = requireEvent(db, id);
  const has = (k: keyof EventPatch) => patch[k] !== undefined;

  if (has("place_id")) requirePlace(db, patch.place_id!);
  const newScanIds = has("scan_ids") ? patch.scan_ids! : [];
  if (newScanIds.length) requireScans(db, newScanIds);
  if (has("times")) validateTimes(patch.times!);
  if (has("confidence") && patch.confidence !== current.confidence && !has("confidence_reason")) {
    throw badRequest("confidence_reason is required when confidence changes", [{ path: "confidence_reason", message: "State why the confidence has the new value." }]);
  }

  const labels: LabelSet = {
    category: has("category") ? patch.category! : current.category,
    interests: has("interests") ? patch.interests! : current.interests,
    suitability: has("suitability") ? patch.suitability! : current.suitability,
  };
  const labelReasons = checkLabels(db, labels);

  const at = now();
  const scanId = newScanIds[0] ?? null;
  const changed = new Set<string>();

  db.transaction((tx) => {
    const updates: Partial<EventRow> = {};
    for (const field of SCALAR_FIELDS) {
      if (!has(field)) continue;
      const next = patch[field];
      const prev = current[field];
      if (JSON.stringify(next) === JSON.stringify(prev)) continue;
      (updates as Record<string, unknown>)[field] = next;
      changed.add(field);
      writeChange(tx, { event_id: id, field, old_value: prev, new_value: next, reason: patch.reason, actor: "agent", scan_id: scanId }, at);
    }

    let times: TimeInput[] = loadTimes(tx, id).map(plainTime);
    if (has("times")) {
      const next = patch.times!.map(plainTime);
      if (JSON.stringify(next) !== JSON.stringify(times)) {
        tx.delete(timesTable).where(eq(timesTable.event_id, id)).run();
        insertTimes(tx, id, next);
        changed.add("times");
        writeChange(tx, { event_id: id, field: "times", old_value: times, new_value: next, reason: patch.reason, actor: "agent", scan_id: scanId }, at);
        times = next;
      }
    }

    const linked = tx.select({ id: scans.id }).from(scans).where(eq(scans.event_id, id)).all().map((s) => s.id);
    const added = newScanIds.filter((s) => !linked.includes(s));
    if (added.length) {
      linkScans(tx, id, added, at);
      writeChange(tx, { event_id: id, field: "scan_ids", old_value: linked, new_value: [...linked, ...added], reason: patch.reason, actor: "agent", scan_id: scanId }, at);
    }

    // An approved event keeps its review state unless a field that review depends on changes.
    if (current.review_state !== "rejected" && [...changed].some((f) => REVIEW_FIELDS.has(f))) {
      const review = reviewOutcome(
        updates.confidence ?? current.confidence,
        updates.confidence_reason ?? current.confidence_reason,
        labelReasons,
        times,
      );
      if (review.review_state !== current.review_state) {
        writeChange(tx, { event_id: id, field: "review_state", old_value: current.review_state, new_value: review.review_state, reason: review.review_reasons.join("; ") || "meets the publish rule", actor: "system", scan_id: scanId }, at);
      }
      Object.assign(updates, review);
    }

    tx.update(events).set({ ...updates, last_updated: at, last_checked: at }).where(eq(events.id, id)).run();
  });
  return getEventDetail(db, id, asOf);
}
