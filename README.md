# Magic Feed

Magic Feed collects events in a place for travel planners. The first place is Hermanus, South Africa. The first source is The Village NEWS events calendar.

## Run

```sh
npm install
npm start            # API on http://localhost:8787, database in ./feed.db
npm test             # end-to-end tests against a temporary database
npm run typecheck
```

`PORT` and `FEED_DB` change the port and the database path. The server applies the database migrations when it starts.

## Pages

- http://localhost:8787/feed lists the events by date. You can filter by trip window, text, category, interests, suitability, status and review state. The details of an event show every date in the window, the confidence and its reason, and the source link.
- http://localhost:8787/ is the guide for agents. It lists the calls for each task.
- http://localhost:8787/openapi.json is the full API schema.

## Flow

1. An agent with the `ingest-sources` skill fetches each active source and posts each item to `POST /scans`. The skill has one section for each source. The Village NEWS is the only source so far. The API stores the item as it is. If an item has the same content as before, the API does not store a new scan, and the linked event gets a new `last_checked` date. If the content changed, the API stores a new pending scan.
2. An agent with the `process-scans` skill reads `GET /scans?state=pending`. For each scan, it creates an event, updates an existing event, or ignores the scan with a reason. It looks for duplicates with `GET /events?name=`. It chooses labels from `GET /vocabulary`, sets a confidence score, and states the fact that lowers the confidence in `confidence_reason`.
3. The API publishes an event when the confidence is 0.8 or higher and all labels are approved. Other events go to `GET /review` with their reasons, for example "confidence 0.6 is below 0.8: The source names no venue and no town." A person approves or rejects them with `POST /events/{id}/review`.
4. A planner's agent with the `find-events` skill searches `GET /events` with the trip dates and the traveller's interests. It reads `GET /changes?since=` to see what changed since the last check.

The skills are in `.claude/skills/`. Claude Code loads them in this folder. Another agent can read the same files as instructions.

## Model

| Entity | Purpose |
|---|---|
| Place | The area that the feed covers, with aliases such as Onrus and Sandbaai. |
| Source | A site that the feed reads. |
| Scan | One raw item from a source, as fetched. |
| Event | What happens, with labels, confidence and its reason, review state and source links. |
| Time | When it happens: one-off, recurring (rrule), continuous or seasonal, with a precision of exact, month or unknown. |
| Event change | One changed field, with the old value, the new value, the reason and the scan that caused it. |
| Term | One allowed label value, approved or proposed. |

The API computes the status of an event for a date: `upcoming`, `running`, `finished`, `expected`, `cancelled` or `postponed`. An event with an unknown date has the status `expected`. Search always includes it, because it is likely to happen.

## Vocabulary

The approved labels are in the `vocabulary` block of `gold/events.json`. When the server starts, it approves every term in that list. An agent can propose a new term with `POST /vocabulary/proposals`. An event that uses a proposed term goes to review. When a term is approved, the API checks the events in review again and publishes the ones that waited only on that term.

## Search

```sh
curl "localhost:8787/events?from=2026-12-10&to=2026-12-20&interests=music,wine&suitability=adults"
```

Each result contains the dates of the event inside the window in `occurrences`. `q` matches names, descriptions and venues. `name` matches only event names, with every word in any order.

## Tests

The tests in `test/` start the real server against a new database and call it over HTTP. `gold.e2e.test.ts` loads the gold set in `gold/events.json`. It then checks the status of each event on 24 November 2026, and it checks the search results for several trip windows.

## Documents

- `docs/design-notes.md`: transcription of the pen and paper notes. The photos are in `docs/notes/`.
- `docs/entities-and-flow.html`: diagram of the entities and the process flow.
- `docs/sources-research.md`: researched sources for Hermanus events.
- `docs/production-improvements.md`: changes for a production version, such as venue lookup with Google Maps and open sources.

## Stack

The API uses Hono with OpenAPI schemas from Zod, and SQLite with Drizzle. The feed page uses Hono JSX on the server. PostgreSQL is the better database for production. The Drizzle schema can change to PostgreSQL with few changes.
