import type { Hono } from "hono";
import type { Db } from "../db/client.js";
import { SearchQuery } from "../domain/types.js";
import { searchEvents } from "../services/search.js";
import { addMonths } from "../services/timeline.js";
import { getVocabulary, requirePlace } from "../services/vocabulary.js";
import { FeedPage, STATUSES, type FeedFilters } from "./feed-page.js";
import { FEED_CSS } from "./styles.js";

const PLACE = "hermanus";
const DEFAULT_STATUS = ["upcoming", "running", "expected"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// The page calls the same search service as GET /events, so the page and the API show the same results.
export function registerFeedPage(app: Hono<any>, db: Db, today: () => string) {
  app.get("/feed/styles.css", (c) => c.body(FEED_CSS, 200, { "content-type": "text/css; charset=utf-8" }));

  app.get("/feed", (c) => {
    const asOf = today();
    const list = (k: string) => (c.req.queries(k) ?? []).filter(Boolean);
    const from = DATE.test(c.req.query("from") ?? "") ? c.req.query("from")! : asOf;
    const to = DATE.test(c.req.query("to") ?? "") ? c.req.query("to")! : addMonths(from, 3);
    const review = c.req.query("review") ?? "published";
    const statusInput = list("status").filter((s) => STATUSES.includes(s));

    const filters: FeedFilters = {
      from,
      to,
      q: c.req.query("q") ?? "",
      category: list("category"),
      interests: list("interests"),
      suitability: list("suitability"),
      status: statusInput.length ? statusInput : DEFAULT_STATUS,
      review: ["published", "needs_review", "any"].includes(review) ? review : "published",
    };

    const csv = (v: string[]) => (v.length ? v.join(",") : undefined);
    const parsed = SearchQuery.safeParse({
      place: PLACE,
      from,
      to,
      q: filters.q || undefined,
      category: csv(filters.category),
      interests: csv(filters.interests),
      suitability: csv(filters.suitability),
      status: csv(filters.status),
      review: filters.review,
      limit: 200,
    });

    const place = requirePlace(db, PLACE);
    const vocabulary = getVocabulary(db);
    if (!parsed.success || from > to) {
      const error = from > to ? "The From date is after the To date." : "Some filter values are not valid.";
      return c.html(
        <FeedPage placeName={place.name} result={{ as_of: asOf, count: 0, events: [] }} filters={filters} vocabulary={vocabulary} error={error} />,
        400,
      );
    }
    const result = searchEvents(db, parsed.data, asOf);
    return c.html(<FeedPage placeName={place.name} result={result} filters={filters} vocabulary={vocabulary} />);
  });
}
