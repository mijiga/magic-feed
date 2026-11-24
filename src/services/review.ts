import { and, asc, eq } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events } from "../db/schema.js";
import type { Event, EventDetail, ReviewDecision } from "../domain/types.js";
import { getEventDetail, requireEvent, toEvent, writeChange } from "./events.js";
import { approveTerms } from "./vocabulary.js";

export function reviewQueue(db: Db, placeId: string, asOf: string): { count: number; events: Event[] } {
  const rows = db
    .select()
    .from(events)
    .where(and(eq(events.place_id, placeId), eq(events.review_state, "needs_review")))
    .orderBy(asc(events.created_at))
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
  return getEventDetail(db, id, asOf);
}
