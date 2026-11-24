import { OpenAPIHono } from "@hono/zod-openapi";
import type { Db } from "./db/client.js";
import * as r from "./api/routes.js";
import { HttpError } from "./services/errors.js";
import { changesSince, createEvent, getEventDetail, listChanges, patchEvent, requireEvent } from "./services/events.js";
import { reviewEvent, reviewQueue } from "./services/review.js";
import { getScan, ignoreScan, ingestScans, listScans, listSources } from "./services/scans.js";
import { searchEvents } from "./services/search.js";
import { todayIn } from "./services/timeline.js";
import { getVocabulary, listPlaces, proposeTerm } from "./services/vocabulary.js";
import { registerFeedPage } from "./web/routes.js";

export interface AppOptions {
  db: Db;
  /** Returns today's date as YYYY-MM-DD. Tests pass a fixed date. */
  today?: () => string;
}

const GUIDE = {
  name: "Magic Feed",
  description:
    "An event feed for travel planners. Sources go in as raw scans. A processing agent turns scans into events with times and labels. " +
    "Events with confidence of at least 0.8 and approved labels go to the feed. Other events wait for human review. " +
    "Dates are local to the place. Search returns the dates of each event inside a trip window.",
  openapi: "/openapi.json",
  workflows: {
    ingest: ["GET /sources", "POST /scans"],
    process: [
      "GET /vocabulary",
      "GET /places",
      "GET /scans?state=pending",
      "GET /events?name=<event name>&review=any (look for a duplicate, and use previous_event_id from the scan)",
      "POST /events, or PATCH /events/{id} to update an existing event, or POST /scans/{id}/ignore",
    ],
    "plan a trip": ["GET /events?from=YYYY-MM-DD&to=YYYY-MM-DD&interests=...&suitability=...", "GET /changes?since=<last look>"],
    review: ["GET /review", "POST /events/{id}/review"],
  },
};

export function createApp({ db, today = () => todayIn("Africa/Johannesburg") }: AppOptions) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        return c.json(
          { error: "Invalid request", details: result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          400,
        );
      }
    },
  });

  app.onError((err, c) => {
    if (err instanceof HttpError) return c.json({ error: err.message, details: err.details }, err.status);
    console.error(err);
    return c.json({ error: "Internal error" }, 500);
  });
  app.notFound((c) => c.json({ error: `No route for ${c.req.method} ${c.req.path}` }, 404));

  app.openapi(r.guideRoute, (c) => c.json(GUIDE, 200));
  app.openapi(r.listPlacesRoute, (c) => c.json({ places: listPlaces(db) }, 200));
  app.openapi(r.getVocabularyRoute, (c) => c.json(getVocabulary(db), 200));
  app.openapi(r.proposeTermRoute, (c) => c.json(proposeTerm(db, c.req.valid("json")), 201));
  app.openapi(r.listSourcesRoute, (c) => c.json({ sources: listSources(db) }, 200));

  app.openapi(r.ingestScansRoute, (c) => c.json(ingestScans(db, c.req.valid("json")), 200));
  app.openapi(r.listScansRoute, (c) => c.json(listScans(db, c.req.valid("query")), 200));
  app.openapi(r.getScanRoute, (c) => c.json(getScan(db, c.req.valid("param").id), 200));
  app.openapi(r.ignoreScanRoute, (c) => c.json(ignoreScan(db, c.req.valid("param").id, c.req.valid("json").reason), 200));

  app.openapi(r.createEventRoute, (c) => c.json(createEvent(db, c.req.valid("json"), today()), 201));
  app.openapi(r.patchEventRoute, (c) =>
    c.json(patchEvent(db, c.req.valid("param").id, c.req.valid("json"), today()), 200),
  );
  app.openapi(r.searchEventsRoute, (c) => c.json(searchEvents(db, c.req.valid("query"), today()), 200));
  app.openapi(r.getEventRoute, (c) =>
    c.json(getEventDetail(db, c.req.valid("param").id, c.req.valid("query").as_of ?? today()), 200),
  );
  app.openapi(r.listChangesRoute, (c) => {
    const { id } = c.req.valid("param");
    requireEvent(db, id);
    return c.json({ changes: listChanges(db, id) }, 200);
  });
  app.openapi(r.listChangesSinceRoute, (c) => {
    const q = c.req.valid("query");
    return c.json({ changes: changesSince(db, q.place, q.since, q.limit) }, 200);
  });

  app.openapi(r.listReviewRoute, (c) => c.json(reviewQueue(db, c.req.valid("query").place, today()), 200));
  app.openapi(r.reviewEventRoute, (c) => c.json(reviewEvent(db, c.req.valid("param").id, c.req.valid("json"), today()), 200));

  registerFeedPage(app, db, today);

  app.doc("/openapi.json", {
    openapi: "3.0.0",
    info: { title: "Magic Feed API", version: "0.1.0", description: GUIDE.description },
  });

  return app;
}
