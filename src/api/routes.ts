import { createRoute, z } from "@hono/zod-openapi";
import {
  ApiError,
  EventDetail,
  EventChange,
  EventInput,
  EventPatch,
  Place,
  ReviewDecision,
  Scan,
  ScanBatchInput,
  ScanBatchResult,
  ScanIgnoreInput,
  ScanState,
  SearchQuery,
  SearchResult,
  Source,
  Term,
  TermProposal,
  Vocabulary,
  Event,
} from "../domain/types.js";

const json = <T extends z.ZodType>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
const body = <T extends z.ZodType>(schema: T) => ({
  body: { content: { "application/json": { schema } }, required: true },
});
const IdParam = z.object({ id: z.string().openapi({ param: { name: "id", in: "path" } }) });
const errors = {
  400: json(ApiError, "The request is not valid. details lists each problem."),
  404: json(ApiError, "Not found."),
};

export const Guide = z
  .object({
    name: z.string(),
    description: z.string(),
    openapi: z.string(),
    workflows: z.record(z.string(), z.array(z.string())),
  })
  .openapi("Guide");

export const guideRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["guide"],
  summary: "Start here. Describes the feed and the order of calls for each task.",
  responses: { 200: json(Guide, "API guide for agents.") },
});

export const listPlacesRoute = createRoute({
  method: "get",
  path: "/places",
  tags: ["reference"],
  summary: "Places the feed covers, with the aliases that count as each place.",
  responses: { 200: json(z.object({ places: z.array(Place) }), "Places.") },
});

export const getVocabularyRoute = createRoute({
  method: "get",
  path: "/vocabulary",
  tags: ["reference"],
  summary: "Allowed values for category, interests and suitability.",
  responses: { 200: json(Vocabulary, "Vocabulary.") },
});

export const proposeTermRoute = createRoute({
  method: "post",
  path: "/vocabulary/proposals",
  tags: ["reference"],
  summary: "Propose a new label. An event that uses a proposed label goes to human review.",
  request: body(TermProposal),
  responses: { 201: json(Term, "The proposed term."), 400: errors[400] },
});

export const listSourcesRoute = createRoute({
  method: "get",
  path: "/sources",
  tags: ["ingestion"],
  summary: "Registered sources.",
  responses: { 200: json(z.object({ sources: z.array(Source) }), "Sources.") },
});

export const ingestScansRoute = createRoute({
  method: "post",
  path: "/scans",
  tags: ["ingestion"],
  summary: "Store raw items from one source. Repeat items with unchanged content do not create new scans.",
  request: body(ScanBatchInput),
  responses: { 200: json(ScanBatchResult, "Outcome for each item."), ...errors },
});

export const listScansRoute = createRoute({
  method: "get",
  path: "/scans",
  tags: ["processing"],
  summary: "List scans. Use state=pending to get the work queue.",
  request: {
    query: z.object({
      state: ScanState.optional(),
      source_id: z.string().optional(),
      limit: z.coerce.number().int().min(1).max(200).default(50),
    }),
  },
  responses: { 200: json(z.object({ count: z.number(), scans: z.array(Scan) }), "Scans, oldest first.") },
});

export const getScanRoute = createRoute({
  method: "get",
  path: "/scans/{id}",
  tags: ["processing"],
  summary: "One scan with its raw data.",
  request: { params: IdParam },
  responses: { 200: json(Scan, "Scan."), 404: errors[404] },
});

export const ignoreScanRoute = createRoute({
  method: "post",
  path: "/scans/{id}/ignore",
  tags: ["processing"],
  summary: "Mark a scan as not an event for this feed, for example outside the place or not something a traveller goes to.",
  request: { params: IdParam, ...body(ScanIgnoreInput) },
  responses: { 200: json(Scan, "Updated scan."), ...errors },
});

export const createEventRoute = createRoute({
  method: "post",
  path: "/events",
  tags: ["processing"],
  summary: "Create an event from one or more scans. Search first, so you do not create a duplicate.",
  request: body(EventInput),
  responses: { 201: json(EventDetail, "Created event."), ...errors },
});

export const patchEventRoute = createRoute({
  method: "patch",
  path: "/events/{id}",
  tags: ["processing"],
  summary: "Update an event. Each changed field is written to the change log with the reason.",
  request: { params: IdParam, ...body(EventPatch) },
  responses: { 200: json(EventDetail, "Updated event."), ...errors },
});

export const searchEventsRoute = createRoute({
  method: "get",
  path: "/events",
  tags: ["feed"],
  summary: "Search the feed for a place and a trip window. Returns the dates inside the window for each event.",
  request: { query: SearchQuery },
  responses: { 200: json(SearchResult, "Matching events."), 400: errors[400] },
});

export const getEventRoute = createRoute({
  method: "get",
  path: "/events/{id}",
  tags: ["feed"],
  summary: "One event with its times, source scans and change log.",
  request: { params: IdParam, query: z.object({ as_of: z.string().optional() }) },
  responses: { 200: json(EventDetail, "Event."), 404: errors[404] },
});

export const listChangesRoute = createRoute({
  method: "get",
  path: "/events/{id}/changes",
  tags: ["feed"],
  summary: "Change log of one event, newest first.",
  request: { params: IdParam },
  responses: { 200: json(z.object({ changes: z.array(EventChange) }), "Changes."), 404: errors[404] },
});

export const listChangesSinceRoute = createRoute({
  method: "get",
  path: "/changes",
  tags: ["feed"],
  summary: "Changes to any event in a place since a date. A planner uses this to see what changed since the last look.",
  request: {
    query: z.object({
      place: z.string().default("hermanus"),
      since: z.string().openapi({ description: "ISO date or datetime." }),
      limit: z.coerce.number().int().min(1).max(500).default(100),
    }),
  },
  responses: { 200: json(z.object({ changes: z.array(EventChange) }), "Changes, newest first."), 400: errors[400] },
});

export const listReviewRoute = createRoute({
  method: "get",
  path: "/review",
  tags: ["review"],
  summary: "Events that wait for human review, with the reasons.",
  request: { query: z.object({ place: z.string().default("hermanus") }) },
  responses: { 200: json(z.object({ count: z.number(), events: z.array(Event) }), "Review queue.") },
});

export const reviewEventRoute = createRoute({
  method: "post",
  path: "/events/{id}/review",
  tags: ["review"],
  summary: "Approve or reject an event. Approval also approves the proposed labels that the event uses.",
  request: { params: IdParam, ...body(ReviewDecision) },
  responses: { 200: json(EventDetail, "Reviewed event."), ...errors },
});
