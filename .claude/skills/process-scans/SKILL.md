---
name: process-scans
description: Turn pending raw scans in the Magic Feed API into events and times, with labels and a confidence score. Use when asked to process scans, update the feed, or run the processing step after ingestion.
---

# Process scans into events

You read pending scans, decide what each one is, and write events through the API. The API is the only way to change data. Do not edit the database.

## Before you start

1. `GET $FEED_API/` (default `http://localhost:8787`) for the guide.
2. `GET $FEED_API/places` for the place and its aliases. The feed covers one place at a time. Hermanus is the first place.
3. `GET $FEED_API/vocabulary` for the allowed `category`, `interests` and `suitability` values. Use only these values.
4. `GET $FEED_API/scans?state=pending&limit=200` for the work queue.

## Decide for each scan

Work in groups. Scans with the same title are often occurrences of one recurring event.

**1. Is it in the place?**
Find the location in the venue, the title or the description. The event is in the place only if the location is the place name or one of its aliases. Examples outside Hermanus: Stanford, Gansbaai, Kleinmond, Cape Town. If you cannot find any location, keep the event but set confidence to 0.6 or lower, so a person checks it.

**2. Is it something a traveller goes to?**
A traveller goes to markets, concerts, festivals, shows, tastings, tours, exhibitions, races and public sports events. Support groups, club meetings for members, school notices and private classes are not for travellers.

If the answer to 1 or 2 is no, call `POST /scans/{id}/ignore` with a short reason, for example "Outside Hermanus: Stanford Square Market."

**3. Is it already in the feed?**
- If the scan has `previous_event_id`, the source changed an item that is already an event. Compare and `PATCH /events/{previous_event_id}` with only the changed fields, the new `scan_ids` and a `reason`.
- Otherwise search `GET /events?name=<event name>&review=any&status=upcoming,running,expected,finished,cancelled,postponed`. `name` matches only event names, and every word must appear. If no result comes back, try again with the two or three most distinctive words. If a match is the same event, PATCH it and add the scan id. Do not create a duplicate.
- Do not use `q` to find duplicates. `q` also matches descriptions, so it returns events that only mention the name.

**4. Build the event.**
- `name`: the event name, without the date and without "Pre-release screening at ...".
- `venue`: the venue name and town as the source states them. Use null if the source has none.
- `description`: two or three plain sentences from the source text. Do not invent facts.
- `price`: the source's cost text, for example "Free" or "R150 per person".
- `times`: see below.
- Labels: choose `category`, at least one `interests` value and at least one `suitability` value from the vocabulary. Choose `adults` only when the source states an age limit, or the event centres on alcohol or nightlife. Otherwise choose `all ages`.
- If no approved value fits, call `POST /vocabulary/proposals` with a reason, then use the proposed term. The event goes to human review.
- `scan_ids`: every scan that the event comes from.

**5. Build the times.**
- One date: `type` one_off, `precision` exact, `start` `YYYY-MM-DD` or `YYYY-MM-DDTHH:MM`, `end` the same day or null.
- Several days in a row: one_off with start and end dates.
- Repeats (the source category "Every week" or "Every month", or the same title on regular dates): `type` recurring, an `rrule` such as `FREQ=WEEKLY;BYDAY=TU` or `FREQ=MONTHLY;BYDAY=1SU`, `start` the first date you see, `end` the last date you see or null when the source says it continues, and `start_time` and `end_time`.
- Open for a period (an exhibition): continuous with start and end.
- Months only (a season): seasonal, precision month, start and end as `MM`.
- Announced without dates: continuous, precision unknown, start and end null.
- A time of 00:00 or a start equal to the end often means the source has no time. Then leave `start_time` and `end_time` null.

**6. Set the confidence.**
- 0.9 or higher: the place, the dates and the labels come straight from the source.
- 0.8 to 0.89: you inferred one thing, for example the recurrence pattern.
- Below 0.8: you guessed the location, the dates or a label. The event goes to human review. This is the correct result when you are not sure.

## Status changes

If the source says that an event is cancelled or postponed, PATCH `state` to `cancelled` or `postponed` with the reason. Never delete an event.

## Report

When the queue is empty, report the number of events created, events updated, scans ignored (with the main reasons), and events sent to review. List each proposed vocabulary term.
