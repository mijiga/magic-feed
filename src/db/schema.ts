import { sqliteTable, text, real, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const places = sqliteTable("places", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  country: text("country").notNull(),
  timezone: text("timezone").notNull(),
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull(),
});

export const terms = sqliteTable(
  "terms",
  {
    kind: text("kind", { enum: ["category", "interests", "suitability"] }).notNull(),
    term: text("term").notNull(),
    status: text("status", { enum: ["approved", "proposed"] }).notNull(),
    reason: text("reason"),
    created_at: text("created_at").notNull(),
  },
  (t) => [uniqueIndex("terms_kind_term").on(t.kind, t.term)],
);

export const sources = sqliteTable("sources", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  kind: text("kind", { enum: ["listing", "organiser", "ticketing", "news", "guide"] }).notNull(),
  place_id: text("place_id").notNull().references(() => places.id),
  active: integer("active", { mode: "boolean" }).notNull(),
});

export const events = sqliteTable(
  "events",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    place_id: text("place_id").notNull().references(() => places.id),
    venue: text("venue"),
    category: text("category").notNull(),
    interests: text("interests", { mode: "json" }).$type<string[]>().notNull(),
    suitability: text("suitability", { mode: "json" }).$type<string[]>().notNull(),
    state: text("state", { enum: ["active", "cancelled", "postponed"] }).notNull(),
    review_state: text("review_state", { enum: ["published", "needs_review", "rejected"] }).notNull(),
    review_reasons: text("review_reasons", { mode: "json" }).$type<string[]>().notNull(),
    confidence: real("confidence").notNull(),
    confidence_reason: text("confidence_reason"),
    price: text("price"),
    booking_url: text("booking_url"),
    ticket_sale_cutoff: text("ticket_sale_cutoff"),
    created_at: text("created_at").notNull(),
    last_updated: text("last_updated").notNull(),
    last_checked: text("last_checked").notNull(),
  },
  (t) => [index("events_place").on(t.place_id), index("events_review").on(t.review_state)],
);

export const times = sqliteTable(
  "times",
  {
    id: text("id").primaryKey(),
    event_id: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    type: text("type", { enum: ["one_off", "recurring", "continuous", "seasonal"] }).notNull(),
    start: text("start"),
    end: text("end"),
    precision: text("precision", { enum: ["exact", "month", "season", "unknown"] }).notNull(),
    rrule: text("rrule"),
    exceptions: text("exceptions", { mode: "json" }).$type<string[]>().notNull(),
    start_time: text("start_time"),
    end_time: text("end_time"),
    note: text("note"),
  },
  (t) => [index("times_event").on(t.event_id)],
);

export const scans = sqliteTable(
  "scans",
  {
    id: text("id").primaryKey(),
    source_id: text("source_id").notNull().references(() => sources.id),
    external_id: text("external_id").notNull(),
    url: text("url"),
    raw: text("raw", { mode: "json" }).notNull(),
    content_hash: text("content_hash").notNull(),
    state: text("state", { enum: ["pending", "processed", "ignored"] }).notNull(),
    event_id: text("event_id").references(() => events.id),
    note: text("note"),
    fetched_at: text("fetched_at").notNull(),
    last_seen_at: text("last_seen_at").notNull(),
    processed_at: text("processed_at"),
  },
  (t) => [
    uniqueIndex("scans_source_ext_hash").on(t.source_id, t.external_id, t.content_hash),
    index("scans_state").on(t.state),
  ],
);

export const eventChanges = sqliteTable(
  "event_changes",
  {
    id: text("id").primaryKey(),
    event_id: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
    field: text("field").notNull(),
    old_value: text("old_value", { mode: "json" }),
    new_value: text("new_value", { mode: "json" }),
    reason: text("reason").notNull(),
    actor: text("actor", { enum: ["agent", "human", "system"] }).notNull(),
    scan_id: text("scan_id"),
    changed_at: text("changed_at").notNull(),
  },
  (t) => [index("changes_event").on(t.event_id)],
);
