# Magic Feed

This project is a take-home assessment for Magic Safari. The brief is in `~/Downloads/Magic Safari homework - Event Feed.pdf`.

## Brief

A travel agent who plans a trip wants to know what is on in a place while the traveller is there: a festival, a concert, a big match, a market. The first version is a feed that collects these events for Hermanus, South Africa. Travellers and the agents who plan trips use the feed.

A luxury trip is usually booked 6 to 18 months before it starts. Closer to the date, the planner refines the trip and books activities. So a planner looks at the same place more than once, months apart. Travellers vary widely in age and interests, so the useful events differ from one trip to the next.

## Event shapes

The model must hold all of these:

- A one-off event: J. Cole in Johannesburg on 12 December 2026, Lions v Munster at Ellis Park on 17 April 2027.
- A recurring event: the Hermanus Country Market on a Saturday.
- A run: a theatre show with 81 dates, an exhibition that is open for a year.
- A far-future event: the FynArts Festival in Hermanus in June 2027.
- A season with months and no date: southern right whales off Hermanus, June to November.
- An expected event with no dates yet: an event that is announced without dates, or an event that usually happens but is not announced yet. The feed still lists it, because it is likely to happen. Its status is `expected` and its Time has precision `unknown`.

## Core goals

The notes name three issues that decide if the feed is useful:

1. The flow of events must be accurate to the give location(Hermanus, South Africa in this case but this can be swapped out).
2. Search results must be accurate to the given search values.
3. Event status must stay up to date: happening, still running, cancelled or finished.
4. Keep track of event changes.

Agents use the feed from the day they take on a trip until the trip starts. Each event needs markers for who it appeals to, such as age, interests and family suitability.

## Deliverables

1. Data model design.
2. An agent-friendly API over that model.
3. A normal Claude or Codex agent that uses the API and does the data processing.
4. Pen and paper notes on the design. The photos are in `docs/notes/`. The transcription is in `docs/design-notes.md`.

## Design

The design is in `docs/design-notes.md`. Read it before you change the model or the API.

- The core entities are Event, Time and Scan.
- An agent with a skill file writes raw source data to Scans.
- A processing step turns Scans into Events and Times. It labels and tags them with rules, LLMs and agents.
- Records with a high confidence score go to the feed. Other records go to human review.
- A consumer agent reads the feed through the API.

## Stack

- API: Hono, in TypeScript.
- Database: SQLite. PostgreSQL is the better choice for production, but SQLite keeps the assessment simple to run.

## Testing

- Write end-to-end tests only. Do not write unit tests.
- Verify the processing against a gold set of events. The user provides the gold set. Do not invent gold set entries.

## Git workflow

- Commits and merges are allowed in this project.
- `main` holds verified milestones. `dev` is the integration branch.
- Use one `feature/*` branch off `dev` for each build step or component.
- Commit after each change that passes `npm run typecheck`. Put one logical change in each commit.
- Merge into `dev` with `--no-ff` when the step's tests pass and the user accepts it.
- DO NOT MAKE HUGE COMMITS/BRANCHES THAT BUNCH TOGETHER SO MANY THINGS.

 ## Agent orchestration

  - Use sub-agents without being asked when two or more components do not depend on each other.
  - Before you start sub-agents, commit the shared contract: the domain types and the API routes. Sub-agents do not change the contract.
  - Give each sub-agent its own worktree (`isolation: "worktree"`) and its own feature branch.
  - Each sub-agent commits on its branch, runs the typecheck and its tests, and reports in 150 words or fewer.
  - The main agent reviews each branch, merges it and runs the full test suite after each merge.
  - Run a maximum of 3 sub-agents at a time, because the Mac has little RAM.
  - Use `/build-feature` for a multi-agent build.