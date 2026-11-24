import type { FC } from "hono/jsx";
import type { SearchResult, SearchResultItem, Vocabulary } from "../domain/types.js";

export interface FeedFilters {
  from: string;
  to: string;
  q: string;
  category: string[];
  interests: string[];
  suitability: string[];
  status: string[];
  review: string;
}

export const STATUSES = ["upcoming", "running", "expected", "finished", "cancelled", "postponed"];
const REVIEW_OPTIONS: [string, string][] = [
  ["published", "Published"],
  ["needs_review", "Needs review"],
  ["any", "All"],
];

const DAY = new Intl.DateTimeFormat("en-ZA", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const MONTH = new Intl.DateTimeFormat("en-ZA", { month: "long", year: "numeric", timeZone: "UTC" });

const dayLabel = (iso: string) =>
  iso.length === 7 ? MONTH.format(new Date(`${iso}-01T00:00:00Z`)) : DAY.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`));
const timeOf = (iso: string) => (iso.length > 10 ? iso.slice(11, 16) : "");

const FREQ: Record<string, string> = { DAILY: "Every day", WEEKLY: "Every week", MONTHLY: "Every month", YEARLY: "Every year" };

function repeatLabel(e: SearchResultItem): string | null {
  const t = e.times[0];
  if (!t) return null;
  if (t.type === "recurring" && t.rrule) return FREQ[/FREQ=(\w+)/.exec(t.rrule)?.[1] ?? ""] ?? "Repeats";
  if (t.type === "seasonal") return "Season";
  if (t.type === "continuous" && t.precision !== "unknown") return "Runs";
  return null;
}

function groupByDay(events: SearchResultItem[]) {
  const dated = new Map<string, { event: SearchResultItem; start: string }[]>();
  const undated: SearchResultItem[] = [];
  for (const event of events) {
    const first = event.occurrences[0];
    if (!first) {
      undated.push(event);
      continue;
    }
    const key = first.start.length === 7 ? first.start : first.start.slice(0, 10);
    const list = dated.get(key) ?? [];
    list.push({ event, start: first.start });
    dated.set(key, list);
  }
  return { dated: [...dated.entries()].sort(([a], [b]) => (a < b ? -1 : 1)), undated };
}

const Check: FC<{ name: string; value: string; checked: boolean; label?: string }> = ({ name, value, checked, label }) => (
  <label class="check">
    <input type="checkbox" name={name} value={value} checked={checked} />
    <span>{label ?? value.replaceAll("_", " ")}</span>
  </label>
);

const EventRow: FC<{ event: SearchResultItem; start?: string }> = ({ event, start }) => {
  const repeat = repeatLabel(event);
  const more = event.occurrences.length - 1;
  return (
    <li class="event">
      <div class="time">{start ? timeOf(start) || "All day" : ""}</div>
      <div class="body">
        <div class="title-row">
          <h3>{event.name}</h3>
          <span class={`pill status-${event.status}`}>{event.status}</span>
          {event.review_state !== "published" && <span class={`pill review-${event.review_state}`}>{event.review_state.replace("_", " ")}</span>}
        </div>
        <p class="meta">
          {[event.venue ?? "Venue not stated", event.price, repeat && (more > 0 ? `${repeat}, ${more + 1} dates in window${event.occurrences_truncated ? "+" : ""}` : repeat)]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <ul class="labels">
          <li class="label category">{event.category.replaceAll("_", " ")}</li>
          {event.interests.map((i) => (
            <li class="label">{i}</li>
          ))}
          {event.suitability.map((s) => (
            <li class="label suit">{s}</li>
          ))}
        </ul>
        <details>
          <summary>Details</summary>
          {event.description && <p class="desc">{event.description}</p>}
          {event.review_reasons.length > 0 && <p class="reasons">Review: {event.review_reasons.join("; ")}</p>}
          {event.occurrences.length > 0 && (
            <p class="dates">
              Dates in window:{" "}
              {event.occurrences.map((o) => `${dayLabel(o.start)}${timeOf(o.start) ? ` ${timeOf(o.start)}` : ""}`).join(", ")}
            </p>
          )}
          <p class="dates">
            Confidence {Math.round(event.confidence * 100)}%{event.confidence_reason ? `: ${event.confidence_reason}` : ""} · Last checked {event.last_checked.slice(0, 10)} · Updated {event.last_updated.slice(0, 10)}
          </p>
          {event.source_urls.map((u) => (
            <p class="source">
              <a href={u} target="_blank" rel="noopener">
                {new URL(u).hostname}
              </a>
            </p>
          ))}
        </details>
      </div>
    </li>
  );
};

export const FeedPage: FC<{ placeName: string; result: SearchResult; filters: FeedFilters; vocabulary: Vocabulary; error?: string }> = ({
  placeName,
  result,
  filters,
  vocabulary,
  error,
}) => {
  const { dated, undated } = groupByDay(result.events);
  return (
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${placeName} events · Magic Feed`}</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;500;600&display=swap"
        />
        <link rel="stylesheet" href="/feed/styles.css" />
      </head>
      <body>
        <header class="top">
          <div class="wrap">
            <h1>{placeName} events</h1>
            <p class="sub">
              {result.count} events between {dayLabel(filters.from)} and {dayLabel(filters.to)}. Status as of {dayLabel(result.as_of)}.
            </p>
          </div>
        </header>
        <main class="wrap layout">
          <form class="filters" method="get" action="/feed">
            <div class="field-row">
              <label class="field">
                <span>From</span>
                <input type="date" name="from" value={filters.from} />
              </label>
              <label class="field">
                <span>To</span>
                <input type="date" name="to" value={filters.to} />
              </label>
            </div>
            <label class="field">
              <span>Search</span>
              <input type="search" name="q" value={filters.q} placeholder="Name, venue or description" />
            </label>
            <fieldset>
              <legend>Category</legend>
              {vocabulary.category.map((t) => (
                <Check name="category" value={t.term} checked={filters.category.includes(t.term)} />
              ))}
            </fieldset>
            <fieldset>
              <legend>Interests</legend>
              {vocabulary.interests.map((t) => (
                <Check name="interests" value={t.term} checked={filters.interests.includes(t.term)} />
              ))}
            </fieldset>
            <fieldset>
              <legend>Suitability</legend>
              {vocabulary.suitability.map((t) => (
                <Check name="suitability" value={t.term} checked={filters.suitability.includes(t.term)} />
              ))}
            </fieldset>
            <fieldset>
              <legend>Status</legend>
              {STATUSES.map((s) => (
                <Check name="status" value={s} checked={filters.status.includes(s)} />
              ))}
            </fieldset>
            <label class="field">
              <span>Review</span>
              <select name="review">
                {REVIEW_OPTIONS.map(([v, l]) => (
                  <option value={v} selected={filters.review === v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            <div class="actions">
              <button type="submit">Apply filters</button>
              <a href="/feed">Reset</a>
            </div>
          </form>

          <section class="results">
            {error && <p class="error">{error}</p>}
            {!error && result.count === 0 && <p class="empty">No events match these filters.</p>}
            {dated.map(([day, rows]) => (
              <section class="day">
                <h2>{dayLabel(day)}</h2>
                <ul class="events">
                  {rows.map(({ event, start }) => (
                    <EventRow event={event} start={start} />
                  ))}
                </ul>
              </section>
            ))}
            {undated.length > 0 && (
              <section class="day">
                <h2>Dates not announced</h2>
                <ul class="events">
                  {undated.map((event) => (
                    <EventRow event={event} />
                  ))}
                </ul>
              </section>
            )}
          </section>
        </main>
      </body>
    </html>
  );
};
