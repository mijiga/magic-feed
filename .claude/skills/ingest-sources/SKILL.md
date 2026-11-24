---
name: ingest-sources
description: Fetch events from each active source of the Magic Feed and store them as raw scans in the Magic Feed API. Use when asked to ingest, scan or refresh the feed's sources.
---

# Ingest sources

This skill copies raw items from the feed's sources into the feed. It does not interpret them. The process-scans skill does that later.

## Settings

- Feed API: `$FEED_API`, default `http://localhost:8787`. Check that `GET $FEED_API/` responds before you start. If it does not respond, tell the user to run `npm start`.
- Sources: `GET $FEED_API/sources`. Ingest each source with `active: true`. Each source has a section below that says how to fetch it. If an active source has no section, report it and continue with the other sources.

## Steps for each source

1. Fetch the items with the method in the source's section.
2. For each item, build one scan item:
   - `external_id`: the source's own id for the item, as a string. If the source has no id, use the item URL.
   - `url`: the item URL, or null.
   - `raw`: the item exactly as the source returned it. Do not shorten text and do not remove fields.
3. Send the items to `POST $FEED_API/scans` as `{ "source_id": "<source id>", "items": [...] }`, at most 100 items in each request.
4. Count the outcomes: `created`, `changed` and `unchanged`.

## Rules

- Do not filter by location, category or date. Store everything. The processing step decides what belongs in the feed.
- If a source returns an error or an empty page, retry once. Then stop that source and report the HTTP status. Do not post partial data as if it were complete.

## Sources

### village-news: The Village NEWS events calendar

- API: `https://thevillagenews.co.za/wp-json/tribe/events/v1/events` (WordPress, The Events Calendar plugin).
- Request page 1 with `per_page=50` and `start_date=<today>`. The source returns events up to 2 years ahead by default.
- Follow `next_rest_url` until it is missing. Stop after 20 pages and report it if the source has more.
- `external_id` is the event `id`. Each occurrence of a weekly event has its own `id`, so store each one as a separate scan.

## Report

For each source, give the number of items fetched and the counts of `created`, `changed` and `unchanged`. Say how many scans now wait in `GET $FEED_API/scans?state=pending`.
