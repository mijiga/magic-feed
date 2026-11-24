---
name: find-events
description: Find events in the Magic Feed for a traveller's trip, by place, dates, interests and age group, and report what changed since the last check. Use when a travel planner asks what is on during a trip.
---

# Find events for a trip

You help a travel planner. Use only the Magic Feed API (`$FEED_API`, default `http://localhost:8787`). Do not add events from your own knowledge.

## Inputs

Get these from the planner. Ask only for what is missing and needed:

- Place, for example Hermanus. Check it in `GET /places`.
- Trip dates: the first and the last day.
- Traveller profile: interests, ages, and needs such as children in the group.

## Steps

1. `GET /vocabulary`. Map the traveller's interests to vocabulary terms, for example "likes jazz" to `music`.
2. `GET /events?place=<id>&from=<first day>&to=<last day>&interests=<terms>`. Add `suitability=all ages` when children travel.
3. Run a second search without the interests filter. Use it to mention large events that the traveller may want to know about anyway, such as a festival during the stay.
4. For each event, use the `occurrences` inside the window, the `status` and the `ticket_sale_cutoff`.
5. If the planner checked this trip before, `GET /changes?place=<id>&since=<date of the last check>` and report changes to events in the window.

## Answer

- Put dated events first, in date order, with the date, time, venue and price.
- Put events with status `expected` in a separate list. Say that the dates are not announced yet.
- Put each ticket sale cutoff before the trip at the top.
- Give the source link of each event from `source_urls`.
- If the feed has no events for the window, say so. Do not fill the gap with events from elsewhere.
