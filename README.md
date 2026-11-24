# Magic Feed

Magic Feed collects events in a place for travel planners. The first place is Hermanus, South Africa. The first source is The Village NEWS events calendar.

## Run

```sh
npm install
npm start            # API on http://localhost:8787, database in ./feed.db
npm test             # end-to-end tests against a temporary database
npm run typecheck
```

`PORT` and `FEED_DB` change the port and the database path.

## Flow

1. An agent with the `ingest-village-news` skill fetches the source and posts each item to `POST /scans`. The API stores the item as it is. If an item has the same content as before, the API does not store a new scan, and the linked event gets a new `last_checked` date. If the content changed, the API stores a new pending scan.
2. An agent with the `process-scans` skill reads `GET /scans?state=pending`. For each scan, it creates an event, updates an existing event, or ignores the scan with a reason. It chooses labels from `GET /vocabulary` and sets a confidence score.
3. The API publishes an event when the confidence is 0.8 or higher and all labels are approved. Other events go to `GET /review`. A person approves or rejects them with `POST /events/{id}/review`.
4. A planner's agent with the `find-events` skill searches `GET /events` with the trip dates and the traveller's interests. It reads `GET /changes?since=` to see what changed since the last check.

The skills are in `.claude/skills/`. Claude Code loads them in this folder. Another agent can read the same files as instructions.

`GET /` describes the API and lists the calls for each task. `GET /openapi.json` has the full schema.

## Model

| Entity | Purpose |
|---|---|
| Place | The area that the feed covers, with aliases such as Onrus and Sandbaai. |
| Source | A site that the feed reads. |
| Scan | One raw item from a source, as fetched. |
| Event | What happens, with labels, confidence, review state and source links. |
| Time | When it happens: one-off, recurring (rrule), continuous or seasonal, with a precision of exact, month or unknown. |
| Event change | One changed field, with the old value, the new value, the reason and the scan that caused it. |
| Term | One allowed label value, approved or proposed. |

The API computes the status of an event for a date: `upcoming`, `running`, `finished`, `expected`, `cancelled` or `postponed`. An event with an unknown date has the status `expected`. Search always includes it, because it is likely to happen.

## Search example

```sh
curl "localhost:8787/events?from=2026-12-10&to=2026-12-20&interests=music,wine&suitability=adults"
```

Each result contains the dates of the event inside the window in `occurrences`.

## Tests

The tests in `test/` start the real server against a new database and call it over HTTP. `gold.e2e.test.ts` loads the gold set in `gold/events.json`. It then checks the status of each event on 24 November 2026, and it checks the search results for several trip windows.

## Stack

The API uses Hono with OpenAPI schemas from Zod, and SQLite with Drizzle. PostgreSQL is the better database for production. The Drizzle schema can change to PostgreSQL with few changes.
