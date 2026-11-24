import { and, asc, eq, sql } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events } from "../db/schema.js";
import type { Event, EventDetail, ReviewDecision } from "../domain/types.js";
import { getEventDetail, loadTimes, requireEvent, reviewOutcome, toEvent, writeChange } from "./events.js";
import { approveTerms, checkLabels } from "./vocabulary.js";

export function reviewQueue(db: Db, placeId: string, asOf: string): { count: number; events: Event[] } {
  const rows = db
    .select()
    .from(events)
    .where(and(eq(events.place_id, placeId), eq(events.review_state, "needs_review")))
    .orderBy(asc(events.created_at), asc(sql`rowid`))
    .all();
  const list = rows.map((r) => toEvent(db, r, asOf));
  return { count: list.length, events: list };
}

export function reviewEvent(db: Db, id: string, decision: ReviewDecision, asOf: string): EventDetail {
  const current = requireEvent(db, id);
  const next = decision.decision === "approve" ? "published" : "rejected";
  const at = new Date().toISOString();
  db.transaction((tx) => {
    tx.update(events)
      .set({ review_state: next, review_reasons: next === "published" ? [] : current.review_reasons, last_updated: at })
      .where(eq(events.id, id))
      .run();
    if (next === "published") approveTerms(tx, current);
    writeChange(tx, { event_id: id, field: "review_state", old_value: current.review_state, new_value: next, reason: decision.note, actor: "human" }, at);
  });
  if (next === "published") recheckReview(db, `A term was approved in the review of '${current.name}'.`);
  return getEventDetail(db, id, asOf);
}

/**
 * Applies the review rule again to every event in review, after a term is approved.
 * Rejected and published events keep their state, because a person decided them.
 */
export function recheckReview(db: Db, reason: string): number {
  const rows = db.select().from(events).where(eq(events.review_state, "needs_review")).all();
  const at = new Date().toISOString();
  let published = 0;
  db.transaction((tx) => {
    for (const row of rows) {
      const outcome = reviewOutcome(row.confidence, row.confidence_reason, checkLabels(db, row), loadTimes(tx, row.id));
      const sameReasons = JSON.stringify(outcome.review_reasons) === JSON.stringify(row.review_reasons);
      if (outcome.review_state === row.review_state && sameReasons) continue;
      tx.update(events).set(outcome).where(eq(events.id, row.id)).run();
      if (outcome.review_state !== row.review_state) {
        published++;
        writeChange(tx, { event_id: row.id, field: "review_state", old_value: row.review_state, new_value: outcome.review_state, reason, actor: "system" }, at);
      }
    }
  });
  return published;
}
