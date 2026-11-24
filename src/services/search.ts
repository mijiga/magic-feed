import { and, eq, like, or } from "drizzle-orm";
import type { Db } from "../db/client.js";
import { events } from "../db/schema.js";
import type { SearchQuery, SearchResult, SearchResultItem } from "../domain/types.js";
import { toEvent } from "./events.js";
import { eventOccurrences, isUnknown, resolveWindow } from "./timeline.js";
import { requirePlace } from "./vocabulary.js";

const DEFAULT_STATUS = ["upcoming", "running", "expected"];

const words = (s: string) => s.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
const nameMatches = (name: string, wanted: string[]) => {
  const have = new Set(words(name));
  return wanted.every((w) => have.has(w));
};

const matchesAny = (have: string[], want?: string[]) => !want?.length || want.some((w) => have.includes(w));

export function searchEvents(db: Db, q: SearchQuery, today: string): SearchResult {
  requirePlace(db, q.place);
  const asOf = q.as_of ?? today;
  const window = resolveWindow(asOf, q.from, q.to);
  const windowed = Boolean(q.from || q.to);
  const statuses = q.status?.length ? q.status : DEFAULT_STATUS;

  const text = q.q?.trim() ? `%${q.q.trim()}%` : null;
  const rows = db
    .select()
    .from(events)
    .where(
      and(
        eq(events.place_id, q.place),
        q.review === "any" ? undefined : eq(events.review_state, q.review),
        text ? or(like(events.name, text), like(events.description, text), like(events.venue, text)) : undefined,
      ),
    )
    .all();

  const nameWords = q.name ? words(q.name) : [];
  const items: SearchResultItem[] = [];
  for (const row of rows) {
    if (nameWords.length && !nameMatches(row.name, nameWords)) continue;
    if (q.category?.length && !q.category.includes(row.category)) continue;
    if (!matchesAny(row.interests, q.interests) || !matchesAny(row.suitability, q.suitability)) continue;
    const event = toEvent(db, row, asOf);
    if (!statuses.includes(event.status)) continue;
    const { occurrences, truncated } = eventOccurrences(event.times, window);
    if (windowed && occurrences.length === 0 && !event.times.some(isUnknown)) continue;
    items.push({ ...event, occurrences, occurrences_truncated: truncated });
  }

  items.sort((a, b) => {
    const fa = a.occurrences[0]?.start;
    const fb = b.occurrences[0]?.start;
    if (fa && fb && fa !== fb) return fa < fb ? -1 : 1;
    if (Boolean(fa) !== Boolean(fb)) return fa ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  const page = items.slice(0, q.limit);
  return { as_of: asOf, count: page.length, events: page };
}
