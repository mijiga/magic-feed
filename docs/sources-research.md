# Hermanus Event Sources

Researched on 24 November 2026. I checked each source with a plain HTTP request from a script. "Blocked" means the site returned a Cloudflare check or a 403.

## Source types

Each source covers a different time window. A planner looks 6 to 18 months ahead, so the feed needs all three types:

- Listings and calendars cover the next few weeks well, but they show few events more than 3 months ahead.
- Organiser sites announce the large annual events months ahead.
- Annual event lists and guide pages give the events and seasons that repeat each year. They are the input for `expected` events.

## Listings and calendars

| Source | Owner | Access | Horizon | Notes |
|---|---|---|---|---|
| The Village NEWS events calendar, thevillagenews.co.za | Local weekly newspaper | JSON REST API (`/wp-json/tribe/events/v1/events`), no block | About 6 weeks, plus monthly recurring events | The API returned 90 upcoming events. It has dates, venue, cost, organiser and categories. It also lists events in Stanford and Gansbaai, so a location filter is necessary. It includes community items such as Al-Anon meetings and chess clubs. |
| Overstrand Tourism Diary, overstrand.gov.za/top-things-to-do-this-weekend | Overstrand Municipality | HTML, no block | 1 week, plus a monthly events PDF | This is the official weekly diary. It is organised by day. |
| Cape Whale Coast, whalecoast.info/events-calendar | Overstrand tourism office | HTML page that links to PDFs | Up to 1 year | The office publishes monthly and annual event lists as PDFs. These lists give the long horizon (FynArts, Whale Festival, Kalfiefees). The site also has the Tourism Diary. The events REST API is not enabled. |
| hermanus-info.co.za/town/events | Integrated Marketing (listing site) | Blocked. It needs a browser. | Mixed | The site has detailed listings, but some are stale. For example, a 2023 Good Friday lunch still shows in the sidebar. The listing date windows come from the site, not from the organiser. |
| xplorio.com/hermanus/en/things-to-do/events | Xplorio (local directory) | HTML, no block | About 1 month | Each recurring event shows all its dates and times. |
| allevents.in/hermanus | allevents.in (aggregator) | HTML with JSON-LD, no block | About 1 month | It collects many events from Facebook. Expect duplicates with other sources. |
| sa-venues.com/events/westerncape/suburb/hermanus | SA-Venues (aggregator) | HTML, no block | About 3 months | It listed events up to March 2027. It said the 2026 Whale Festival dates were still to be confirmed after other sources had published them. |
| hermanus.co.za | Local guide site | HTML, no block | Annual | The pages on annual events, markets and whale watching are static guides. They are useful for seasons and recurring markets, but they have no current dates. |
| wesgro.co.za/travel/events | Wesgro (Western Cape tourism agency) | HTML, no block | Months | This is a regional calendar. It lists only the large Hermanus events. |

## Ticketing

| Source | Access | Notes |
|---|---|---|
| Quicket, quicket.co.za | HTML, no block | Most local concerts and runs sell tickets here. Each event page gives prices, age limits ("No under 16s") and sales windows. There is an organiser page named "Everything HERMANUS Events". |
| Webtickets | Not checked | The FynArts Festival sells its tickets here. |
| Computicket | Not checked | The search found only one Benguela Cove event. |

## Organisers of annual events

| Event | Source | Usual dates | Access |
|---|---|---|---|
| Hermanus FynArts | hermanusfynarts.co.za | June, 10 days. The site also lists other events during the year. | HTML, no block |
| Hermanus Whale Festival | hermanuswhalefestival.co.za | Early October (2 to 4 October 2026) | REST API exists but returns no events |
| Kalfiefees (Hermanus arts festival) | kalfiefees-hermanus.co.za | Early August | HTML |
| Hermanus Trail Run | Energy Events, listed on gotrail.run and racepass.com | 26 to 28 February 2027 | gotrail.run is blocked |
| Hermanus Wine and Food Festival | Hermanus Wine Village | August or early October. The sources disagree. | Not checked |
| Hemel-en-Aarde Pinot Noir and Chardonnay Celebration | Hemel-en-Aarde Wine Route, on Quicket | January | Quicket |
| Benguela Cove events | benguelacove.co.za | During the whole year | HTML, no block |
| Classical concerts | Hermanus Music Society, Overstrand Arts (OAK) | About once a month | No site found. The concerts are announced in the Hermanus Times. |

## News

| Source | Access | Notes |
|---|---|---|
| Hermanus Times, novanews.co.za/hermanustimes | WordPress REST API for posts | The paper announces events in news articles, so an LLM must extract the event from free text. |
| Hermanus Scoop, hermanusscoop.beehiiv.com | HTML newsletter | This is a local newsletter. |

## Blocked sources

These sites returned 403 to a plain request: capetown.travel, bandsintown.com and gotrail.run. They need a browser, or I leave them out.
