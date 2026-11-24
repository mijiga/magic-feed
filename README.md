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

1. The [`ingest-sources`](.claude/skills/ingest-sources/SKILL.md) agent posts each source item to `POST /scans`. Unchanged items do not create new scans.
2. The [`process-scans`](.claude/skills/process-scans/SKILL.md) agent turns pending scans into events, or ignores them with a reason.
3. Events with confidence 0.8 or higher and approved labels are published. The rest go to `GET /review`.
4. The [`find-events`](.claude/skills/find-events/SKILL.md) agent searches `GET /events` by trip dates and interests.

## Run the flow

You need Node 22 or later and Claude Code or Codex.

1. Start the API with an empty database:

   ```sh
   npm install
   rm -f feed.db feed.db-wal feed.db-shm
   npm start
   ```

2. In a second terminal in this folder, run `claude`. Allow `curl` and `python3` when it asks.
3. Run `/ingest-sources`.
4. Run `/process-scans`. This takes a few minutes.
5. Open http://localhost:8787/feed. Set Review to All to see every event. `curl localhost:8787/review` lists the events that wait for a person.
6. Run `/find-events` with a trip, for example: `/find-events A couple stays in Hermanus from 3 to 12 December 2026. They like live music, wine and weekend markets.`

With Codex or another agent, use the prompt `Read .claude/skills/<skill>/SKILL.md and follow it.` The skills are in [`.claude/skills/`](.claude/skills/).

### Results of a run on 24 November 2026

- Ingestion: 90 items.
- Processing: 26 events, 41 scans ignored (outside Hermanus or not for travellers).
- Published: 14. In review: 12, all because the source gives no town.
- Trip search (step 6): 8 events with dates, prices and source links.

## Tests

End-to-end tests over HTTP. [`gold.e2e.test.ts`](test/gold.e2e.test.ts) checks the gold set in [`gold/events.json`](gold/events.json). All tests are in [`test/`](test/).

## Production improvements

### Venue location lookup

Many sources name a venue but no town, so the agent cannot confirm the location and the event goes to review. In production, the agent will look up the venue on Google Maps.

### Open sources

I do not agree with a fixed set of sources, because it limits the feed. A fixed set helps to keep out scams, but open sources give more benefit.

The first version reads only The Village NEWS. In production, the agent will search all the sources in [`docs/sources-research.md`](docs/sources-research.md) and find new ones. It will link listings of the same event and use each one to fill gaps in the others.

### Database

The first version uses SQLite. Production could ideally use PostgreSQL.

## Documents

- Design write-up: https://claude.ai/artifact/CTG3cyJAsXMKNdh5EdAqsZ. It has the plan, model, interface, agent tasks, verification cases and execution plan. The source is [`docs/design-writeup.html`](docs/design-writeup.html). (I put this together after the fact. Project direction was from hand written notes)
- [`docs/design-notes.md`](docs/design-notes.md): transcription of the pen and paper notes.
- Pen and paper notes:
  - [Page 1: event feed, core issues and failure points](docs/notes/notes-page-1.jpg)
  - [Page 2: process, entities and process flow](docs/notes/notes-page-2.jpg)
- Entities and flow: https://claude.ai/artifact/38Nn9HQhPLYFTk6VdyuFAk. It shows the entities and the process flow from the pen and paper notes. The source is [`docs/entities-and-flow.html`](docs/entities-and-flow.html).
- [`docs/sources-research.md`](docs/sources-research.md): researched sources for Hermanus events.
- [`magic-feed-conversation.txt`](magic-feed-conversation.txt): export of the Claude Code conversation in which I built the project.

## Stack

The API uses Hono with OpenAPI schemas from Zod, and SQLite with Drizzle. The feed page uses Hono JSX on the server. PostgreSQL is the better database for production. The Drizzle schema can change to PostgreSQL with few changes.
