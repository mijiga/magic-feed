# Production Improvements

This file lists the changes that the first version does not include but a production version needs.

## Venue location lookup

Many source items name a venue but no town, for example "Road House Cinema, Whale Coast Mall", "Panthera Africa" or "Landskein". Some items name no venue at all. In the first version, the processing agent cannot confirm that these events are in the place. It gives them low confidence, and they go to human review. In the first Village NEWS run, 12 of 26 events went to review for this reason.

In production, the processing agent looks up the venue with the Google Maps Places API. The agent compares the address and the coordinates with the boundary of the place. If the venue is inside the boundary, the agent records the location and keeps a high confidence. If the venue is outside, the agent ignores the scan with the reason. If the lookup finds no venue or more than one, the event goes to human review.

The feed stores each confirmed venue with its coordinates. The next event at the same venue does not need a new lookup.

Without this lookup, the feed must leave these events out, or a person must check each one every week.

## Database

The first version uses SQLite. Production uses PostgreSQL.
