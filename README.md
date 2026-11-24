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

## Run the flow

An agent does steps 1, 2 and 4 by following a skill. Each skill is a Markdown file in `.claude/skills/<name>/SKILL.md`. The agent reads it and calls the API with curl. You need Node 22 or later and Claude Code or Codex.

**1. Start the API with an empty database.** Keep this terminal open.

```sh
npm install
rm -f feed.db feed.db-wal feed.db-shm
npm start
```

**2. Open a second terminal in this folder and start an agent.**

With Claude Code, run `claude`. Claude Code loads the three skills from `.claude/skills/`, so you can call them as slash commands. Allow the agent to run `curl` and `python3` when it asks.

With Codex or another agent, give the path of the skill file in the prompt, as in the prompts below.

**3. Ingest the sources.**

```text
/ingest-sources
```

Other agents: `Read .claude/skills/ingest-sources/SKILL.md and follow it. The API runs at http://localhost:8787.`

The agent fetches The Village NEWS calendar and posts every item to the API. Check the result with `curl "localhost:8787/scans?state=pending&limit=1"`. The `count` field shows the number of scans that wait for processing.

**4. Process the scans.**

```text
/process-scans
```

Other agents: `Read .claude/skills/process-scans/SKILL.md and follow it until no scan is pending.`

The agent decides for each scan if it is an event in Hermanus for travellers. It creates the events, merges repeated listings into one recurring event, and ignores the rest with a reason. This step takes a few minutes.

**5. Look at the result.**

- http://localhost:8787/feed shows the published events. Set Review to All to see every event.
- `curl localhost:8787/review` lists the events that wait for a person, with the reason for each one.
- To approve one: `curl -X POST localhost:8787/events/<id>/review -H 'content-type: application/json' -d '{"decision":"approve","note":"Checked the venue."}'`

**6. Plan a trip.**

```text
/find-events A couple in their fifties stays in Hermanus from 3 to 12 December 2026. They like live music and wine, and they enjoy markets on a weekend morning. What is on while they are there?
```

The agent searches the feed for the trip window and the interests, and answers with dates, times, venues, prices and source links.

**7. Run it again.** Run `/ingest-sources` again. Items with the same content come back `unchanged` and create no new scans. Changed items become new pending scans, and `/process-scans` updates the existing events. `GET /changes?since=<date>` lists every change.

### Results of a run on 24 November 2026

- Ingestion: 90 items from 2 pages of The Village NEWS.
- Processing: 26 events (14 recurring), 41 scans ignored. 21 ignored scans were outside Hermanus (Stanford, Gansbaai, Greyton, Elim), and 20 were not for travellers (club meetings, support groups).
- Published: 14 events. In review: 12 events. Each one in review names no town for its venue, for example "confidence 0.7 is below 0.8: The source names the venue 'Road House Cinema, Whale Coast Mall' but no town." The venue lookup under Production improvements removes most of this review work.
- Trip search with the step 6 prompt: 8 events, including three concerts at Hermanus Golf Club, the Hermanus Country Market on both Saturdays and a vineyard afternoon in the Hemel-en-Aarde Valley. Each one has its date, time, price and source link. The agent also listed the First Fridays Art Walk from a second search without the interests filter.

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

## Production improvements

The first version does not include these changes. A production version needs them.

### Venue location lookup

Many source items name a venue but no town, for example "Road House Cinema, Whale Coast Mall", "Panthera Africa" or "Landskein". Some items name no venue at all. In the first version, the processing agent cannot confirm that these events are in the place. It gives them low confidence, and they go to human review. In the first Village NEWS run, 12 of 26 events went to review for this reason.

In production, the processing agent looks up the venue with the Google Maps Places API. The agent compares the address and the coordinates with the boundary of the place. If the venue is inside the boundary, the agent records the location and keeps a high confidence. If the venue is outside, the agent ignores the scan with the reason. If the lookup finds no venue or more than one, the event goes to human review.

The feed stores each confirmed venue with its coordinates. The next event at the same venue does not need a new lookup.

Without this lookup, the feed must leave these events out, or a person must check each one every week.

### Open sources

I do not agree with a fixed set of sources, because a fixed set limits the feed. A fixed set helps to keep out scams and fake events, but the benefits of open sources are larger than this risk.

The first version reads only The Village NEWS. In production, the agent will search for events in all the sources in `docs/sources-research.md`, and it will also find new sources. The researched list will be a starting point, not a limit.

When listings from different sources describe the same event, the agent will link them to one event. It will use each listing to fill the gaps in the others. For example, one listing gives the venue and another gives the price and the ticket sales window. The model already supports this, because an event can come from scans of more than one source.

### Database

The first version uses SQLite. Production uses PostgreSQL.

## Documents

- Design write-up: https://claude.ai/artifact/CTG3cyJAsXMKNdh5EdAqsZ. It has the plan, model, interface, agent tasks, verification cases and execution plan. The source is `docs/design-writeup.html`.
- `docs/design-notes.md`: transcription of the pen and paper notes. The photos are in `docs/notes/`.
- Entities and flow: https://claude.ai/artifact/38Nn9HQhPLYFTk6VdyuFAk. It shows the entities and the process flow from the pen and paper notes. The source is `docs/entities-and-flow.html`.
- `docs/sources-research.md`: researched sources for Hermanus events.

## Stack

The API uses Hono with OpenAPI schemas from Zod, and SQLite with Drizzle. The feed page uses Hono JSX on the server. PostgreSQL is the better database for production. The Drizzle schema can change to PostgreSQL with few changes.
