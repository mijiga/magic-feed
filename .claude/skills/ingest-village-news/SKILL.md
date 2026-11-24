---
name: ingest-village-news
description: Fetch upcoming events from The Village NEWS events calendar and store them as raw scans in the Magic Feed API. Use when asked to ingest, scan or refresh The Village NEWS source.
---

# Ingest The Village NEWS

This skill copies raw items from one source into the feed. It does not interpret them. The process-scans skill does that later.

## Settings

- Feed API: `$FEED_API`, default `http://localhost:8787`. Check that `GET $FEED_API/` responds before you start. If it does not respond, tell the user to run `npm start`.
- Source id: `village-news`. Confirm it is in `GET $FEED_API/sources`.
- Source API: `https://thevillagenews.co.za/wp-json/tribe/events/v1/events` (WordPress, The Events Calendar plugin).

## Steps

1. Request page 1 with `per_page=50` and `start_date=<today>`. The source returns events up to 2 years ahead by default.
2. Follow `next_rest_url` until it is missing. Stop after 20 pages and report it if the source has more.
3. For each event, build one scan item:
   - `external_id`: the event `id` as a string.
   - `url`: the event `url`.
   - `raw`: the whole event object, unchanged. Do not shorten the description and do not remove fields.
4. Send the items to `POST $FEED_API/scans` as `{ "source_id": "village-news", "items": [...] }`, at most 100 items in each request.
5. Count the outcomes: `created`, `changed` and `unchanged`.

## Rules

- Do not filter by location, category or date. Store everything. The processing step decides what belongs in the feed.
- Each occurrence of a weekly event has its own `id` in this source. Store each one as a separate scan.
- If the source returns an error or an empty page, retry once. Then stop and report the HTTP status. Do not post partial data as if it were complete.

## Report

Give the number of pages fetched, the number of items, and the counts of `created`, `changed` and `unchanged`. Say how many scans now wait in `GET $FEED_API/scans?state=pending`.
