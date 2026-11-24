import { z } from "@hono/zod-openapi";

// Dates are local to the feed's place (Africa/Johannesburg for Hermanus). No UTC conversion.
const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const HhMm = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const TimeType = z.enum(["one_off", "recurring", "continuous", "seasonal"]);
export const Precision = z.enum(["exact", "month", "season", "unknown"]);
export const EventState = z.enum(["active", "cancelled", "postponed"]);
export const ComputedStatus = z.enum(["upcoming", "running", "finished", "expected", "cancelled", "postponed"]);
export const ReviewState = z.enum(["published", "needs_review", "rejected"]);
export const ScanState = z.enum(["pending", "processed", "ignored"]);
export const SourceKind = z.enum(["listing", "organiser", "ticketing", "news", "guide"]);
export const VocabularyKind = z.enum(["category", "interests", "suitability"]);
export const TermStatus = z.enum(["approved", "proposed"]);
export const ChangeActor = z.enum(["agent", "human", "system"]);

export const Place = z
  .object({
    id: z.string().openapi({ example: "hermanus" }),
    name: z.string(),
    country: z.string(),
    timezone: z.string(),
    aliases: z.array(z.string()).openapi({ description: "Suburbs and nearby areas that count as this place." }),
  })
  .openapi("Place");

export const Term = z
  .object({ kind: VocabularyKind, term: z.string(), status: TermStatus })
  .openapi("Term");

export const Vocabulary = z
  .object({ category: z.array(Term), interests: z.array(Term), suitability: z.array(Term) })
  .openapi("Vocabulary");

export const TermProposal = z
  .object({ kind: VocabularyKind, term: z.string().min(2), reason: z.string().min(3) })
  .openapi("TermProposal");

export const Source = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/).openapi({ example: "village-news" }),
    name: z.string(),
    url: z.string().url(),
    kind: SourceKind,
    place_id: z.string(),
    active: z.boolean(),
  })
  .openapi("Source");

export const ScanItemInput = z.object({
  external_id: z.string().openapi({ description: "The source's own id for this item." }),
  url: z.string().url().nullable(),
  raw: z.unknown().openapi({ description: "The item exactly as the source returned it." }),
});

export const ScanBatchInput = z
  .object({ source_id: z.string(), items: z.array(ScanItemInput).min(1).max(500) })
  .openapi("ScanBatchInput");

export const ScanIngestOutcome = z.enum(["created", "changed", "unchanged"]);

export const ScanBatchResult = z
  .object({
    results: z.array(
      z.object({
        external_id: z.string(),
        scan_id: z.string(),
        outcome: ScanIngestOutcome.openapi({
          description:
            "created: first time seen. changed: content differs from the last scan, so a new pending scan exists. unchanged: same content, no new scan, and the linked event's last_checked moves forward.",
        }),
      }),
    ),
  })
  .openapi("ScanBatchResult");

export const Scan = z
  .object({
    id: z.string(),
    source_id: z.string(),
    external_id: z.string(),
    url: z.string().nullable(),
    raw: z.unknown(),
    content_hash: z.string(),
    state: ScanState,
    event_id: z.string().nullable(),
    previous_event_id: z
      .string()
      .nullable()
      .openapi({ description: "Event linked to an earlier scan of the same external_id. Update that event instead of creating a new one." }),
    note: z.string().nullable(),
    fetched_at: z.string(),
    last_seen_at: z.string(),
    processed_at: z.string().nullable(),
  })
  .openapi("Scan");

export const ScanIgnoreInput = z
  .object({ reason: z.string().min(3).openapi({ example: "Outside Hermanus: the venue is in Stanford." }) })
  .openapi("ScanIgnoreInput");

export const TimeInput = z
  .object({
    type: TimeType,
    start: z.string().nullable().openapi({
      description:
        "exact: YYYY-MM-DD or YYYY-MM-DDTHH:MM. month: YYYY-MM, or MM for a season that repeats every year. unknown: null.",
    }),
    end: z.string().nullable(),
    precision: Precision,
    rrule: z.string().nullable().default(null).openapi({ example: "FREQ=MONTHLY;BYDAY=1SU", description: "RFC 5545 RRULE without DTSTART. start and end bound it." }),
    exceptions: z.array(IsoDate).default([]).openapi({ description: "Dates on which a recurring event does not happen." }),
    start_time: HhMm.nullable().default(null),
    end_time: HhMm.nullable().default(null),
    note: z.string().nullable().default(null),
  })
  .openapi("TimeInput");

export const Time = TimeInput.extend({ id: z.string(), event_id: z.string() }).openapi("Time");

export const Labels = z.object({
  category: z.string(),
  interests: z.array(z.string()).min(1),
  suitability: z.array(z.string()).min(1),
});

// Defaults live only on EventInput. A default inside EventPatch would turn a missing key into a change.
const EventFields = z.object({
  name: z.string().min(2),
  description: z.string().nullable(),
  place_id: z.string(),
  venue: z.string().nullable(),
  ...Labels.shape,
  state: EventState,
  confidence: z.number().min(0).max(1).openapi({ description: "Processing confidence. Below 0.8 sends the event to human review." }),
  price: z.string().nullable().openapi({ example: "R650 early bird, R750 regular" }),
  booking_url: z.string().url().nullable(),
  ticket_sale_cutoff: IsoDate.nullable(),
  times: z.array(TimeInput).min(1),
  scan_ids: z.array(z.string()).min(1).openapi({ description: "Scans this event comes from. They become processed." }),
});

export const EventInput = EventFields.extend({
  description: EventFields.shape.description.default(null),
  state: EventState.default("active"),
  price: EventFields.shape.price.default(null),
  booking_url: EventFields.shape.booking_url.default(null),
  ticket_sale_cutoff: EventFields.shape.ticket_sale_cutoff.default(null),
}).openapi("EventInput");

export const EventPatch = EventFields.partial()
  .extend({
    reason: z.string().min(3).openapi({ description: "Why the event changed. Stored in the change log." }),
  })
  .openapi("EventPatch");

export const EventChange = z
  .object({
    id: z.string(),
    event_id: z.string(),
    field: z.string(),
    old_value: z.unknown(),
    new_value: z.unknown(),
    reason: z.string(),
    actor: ChangeActor,
    scan_id: z.string().nullable(),
    changed_at: z.string(),
  })
  .openapi("EventChange");

export const Occurrence = z
  .object({
    start: z.string(),
    end: z.string().nullable(),
    precision: Precision,
  })
  .openapi("Occurrence");

export const Event = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    place_id: z.string(),
    venue: z.string().nullable(),
    ...Labels.shape,
    state: EventState,
    status: ComputedStatus.openapi({ description: "Status on the as_of date of the request." }),
    review_state: ReviewState,
    review_reasons: z.array(z.string()),
    confidence: z.number(),
    price: z.string().nullable(),
    booking_url: z.string().nullable(),
    ticket_sale_cutoff: z.string().nullable(),
    source_urls: z.array(z.string()),
    times: z.array(Time),
    created_at: z.string(),
    last_updated: z.string(),
    last_checked: z.string(),
  })
  .openapi("Event");

export const EventDetail = Event.extend({
  scan_ids: z.array(z.string()),
  changes: z.array(EventChange),
}).openapi("EventDetail");

export const SearchResultItem = Event.extend({
  occurrences: z.array(Occurrence).openapi({ description: "Dates inside the search window, at most 20." }),
  occurrences_truncated: z.boolean(),
}).openapi("SearchResultItem");

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined));

export const SearchQuery = z.object({
  place: z.string().default("hermanus"),
  from: IsoDate.optional().openapi({ description: "First day of the trip window." }),
  to: IsoDate.optional().openapi({ description: "Last day of the trip window." }),
  interests: csv.openapi({ type: "string", example: "music,wine", description: "Match any." }),
  suitability: csv.openapi({ type: "string", example: "all ages", description: "Match any." }),
  category: csv.openapi({ type: "string", description: "Match any." }),
  status: csv.openapi({ type: "string", description: "Default: upcoming,running,expected." }),
  q: z.string().optional().openapi({ description: "Text match on name, description and venue." }),
  name: z.string().optional().openapi({
    description: "Name match only: every word must appear in the event name, in any order. Use it to find duplicates.",
  }),
  review: z.enum(["published", "needs_review", "rejected", "any"]).default("published"),
  as_of: IsoDate.optional().openapi({ description: "Date used to compute status. Default: today in the place's timezone." }),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const SearchResult = z
  .object({ as_of: z.string(), count: z.number(), events: z.array(SearchResultItem) })
  .openapi("SearchResult");

export const ReviewDecision = z
  .object({ decision: z.enum(["approve", "reject"]), note: z.string().min(3) })
  .openapi("ReviewDecision");

export const ApiError = z
  .object({ error: z.string(), details: z.unknown().optional() })
  .openapi("ApiError");

export type TimeType = z.infer<typeof TimeType>;
export type Precision = z.infer<typeof Precision>;
export type EventState = z.infer<typeof EventState>;
export type ComputedStatus = z.infer<typeof ComputedStatus>;
export type ReviewState = z.infer<typeof ReviewState>;
export type ScanState = z.infer<typeof ScanState>;
export type Place = z.infer<typeof Place>;
export type Term = z.infer<typeof Term>;
export type Vocabulary = z.infer<typeof Vocabulary>;
export type TermProposal = z.infer<typeof TermProposal>;
export type Source = z.infer<typeof Source>;
export type ScanBatchInput = z.infer<typeof ScanBatchInput>;
export type ScanBatchResult = z.infer<typeof ScanBatchResult>;
export type Scan = z.infer<typeof Scan>;
export type TimeInput = z.infer<typeof TimeInput>;
export type Time = z.infer<typeof Time>;
export type EventInput = z.infer<typeof EventInput>;
export type EventPatch = z.infer<typeof EventPatch>;
export type EventChange = z.infer<typeof EventChange>;
export type Occurrence = z.infer<typeof Occurrence>;
export type Event = z.infer<typeof Event>;
export type EventDetail = z.infer<typeof EventDetail>;
export type SearchQuery = z.infer<typeof SearchQuery>;
export type SearchResultItem = z.infer<typeof SearchResultItem>;
export type SearchResult = z.infer<typeof SearchResult>;
export type ReviewDecision = z.infer<typeof ReviewDecision>;

export const REVIEW_CONFIDENCE_THRESHOLD = 0.8;
