# Design Notes

This file is a transcription of my pen and paper notes. The photos are in `docs/notes/`. I fixed spelling only. Words that I could not read with certainty are marked `[?]`.

## Event Feed

Source: `IMG_4199.jpg`

- Travel agents
- Traveller
- Event
- This feed is looked at from the day the agent is engaged up to days leading up to the trip.
- Events aren't necessarily updated realtime but simply at a cadence where you don't miss out on important dates like ticket sale cut offs.
- Events need markers for who they appeal to, so things like age, interests, family friendliness etc.
- Having a favourites list & list management wouldn't be too bad either.
- You could also consider just building up a profile of the traveller & having recommendations given against that.

## Core issues

Source: `IMG_4200.jpg`

There are 3/4 issues here that are core to this feed being useful:

- Get flow of events accurate to the location.
- Searchability/accuracy of recommendation based on traveller profile.
- Keeping status of events up to date (as in actually happening, still happening etc).

## Potential failure points

Source: `IMG_4200.jpg`, `IMG_4201.jpg`

**In getting events**

- Getting events for wrong location.
- Having too few events for god knows what reason.
- Missing out on event for some criteria, blindspot.

**In keeping information fresh & up-to-date**

- Not much room for failure here once data sources are pinned down. Just make sure the cron for scraping always runs.
- Or maybe updateability and conflict of information from sources.
  - Rules + agent decisions will help here.

**In searchability & recommendation accuracy**

- Poorly labelled/marked/categorised events, which impacts their ability to be found.
- Categories/labels that are too broad, such that every event is a fit for everyone.
- Poor relationships between categories & subcategories.

## The process

Source: `IMG_4202.jpg`

The general process is that information is pulled via whatever means, stored as a dump in a table, following which it is processed, in which it gets labelled and tagged using rules, LLMs and agents. The ones with a high confidence score go straight to the feed and ones needing human review await just that.

Sources → Ingestion → Processing

Core parts:

- Event
- Time
- Scans/Observations

## Entities

Source: `IMG_4202.jpg`, `IMG_4203.jpg`, `IMG_4204.jpg`

**Event**

- ID
- Name
- Category
- ~~Tags~~ (crossed out)
- Confidence
- Last checked
- Last updated
- Interests (music, botany, nature etc)
- Suitability (accessible, child friendly, for kids etc)

**Time**

- ID
- Event ID
- Type (one off, recurring, continuous, seasonal)
- Start
- End
- Precision (exact, month, season)
- Exceptions
- Recurrence rule (rrule)

**Scans**

- ID
- Event ID
- Source ID
- Date
- Raw data

## Process flow

Source: `IMG_4212.jpg` (latest). `IMG_4204.jpg` has the earlier version.

```
Agent + skill file
        │
        ▼
      Scans
        │
        ▼
Process scans into events & time
        │                 │
        ▼                 ▼
     Events             Times
        │                 │
        └──────► API ◄────┘
                  ▲
                  │
           Consumer agent
```

In the earlier version, an "Ingestion agent" box wrote to Scans. In the latest version, I crossed it out and replaced it with "Agent + skill file".

## Stack and testing decisions

These decisions are not in the photos. I made them after the notes.

- API: Hono.
- Database: SQLite. PostgreSQL is the better choice for production.
- Tests: end-to-end tests only. No unit tests.
- Verification: a gold set of events. I will provide the gold set.
