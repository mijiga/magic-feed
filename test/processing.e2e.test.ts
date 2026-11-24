import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

describe("processing", () => {
  let s: TestServer;
  let eventId: string;
  let firstScan: string;
  const start = new Date(Date.now() - 1000).toISOString();

  beforeAll(async () => {
    s = await startServer();
  });
  afterAll(() => s.close());

  it("creates an event from a scan and links the scan", async () => {
    firstScan = (await ingestOne(s, "market-1", { title: "Country Market" }, "https://example.com/market")).scan_id;
    const res = await s.post("/events", eventBody({ scan_ids: [firstScan] }));
    expect(res.status).toBe(201);
    eventId = res.body.id;
    expect(res.body).toMatchObject({
      review_state: "published",
      review_reasons: [],
      status: "running",
      source_urls: ["https://example.com/market"],
      scan_ids: [firstScan],
    });
    expect(res.body.times[0]).toMatchObject({ rrule: "FREQ=WEEKLY;BYDAY=SA", exceptions: [], event_id: eventId });
    expect(res.body.changes).toHaveLength(1);
    expect(res.body.changes[0]).toMatchObject({ field: "created", actor: "agent", scan_id: firstScan });

    const scan = await s.get(`/scans/${firstScan}`);
    expect(scan.body).toMatchObject({ state: "processed", event_id: eventId });
    expect(scan.body.processed_at).toBeTruthy();
  });

  it("rejects unknown places, scans and labels", async () => {
    const place = await s.post("/events", eventBody({ place_id: "cape-town", scan_ids: [firstScan] }));
    expect(place.status).toBe(400);
    const scan = await s.post("/events", eventBody({ scan_ids: ["missing"] }));
    expect(scan.status).toBe(400);
    expect(scan.body.details.unknown).toEqual(["missing"]);
    const label = await s.post("/events", eventBody({ interests: ["golf"], scan_ids: [firstScan] }));
    expect(label.status).toBe(400);
    expect(label.body.details[0]).toMatchObject({ field: "interests", unknown: ["golf"] });
    expect(label.body.details[0].allowed).toContain("food");
  });

  it("finds the existing event with a text search before creating a duplicate", async () => {
    const res = await s.get("/events?q=country%20MARKET&review=any");
    expect(res.body.count).toBe(1);
    expect(res.body.events[0].id).toBe(eventId);
    expect((await s.get("/events?q=cricket%20club")).body.count).toBe(1);
    expect((await s.get("/events?q=rugby")).body.count).toBe(0);
  });

  it("patches an event and logs each changed field", async () => {
    const changed = await ingestOne(s, "market-1", { title: "Country Market", day: "Sunday" }, "https://example.com/market");
    expect(changed.outcome).toBe("changed");
    const res = await s.patch(`/events/${eventId}`, {
      venue: "Hermanus Cricket Club",
      price: "Free entry",
      times: [{ type: "recurring", start: "2026-01-04", end: null, precision: "exact", rrule: "FREQ=WEEKLY;BYDAY=SU", start_time: "08:30", end_time: "12:30" }],
      scan_ids: [changed.scan_id],
      reason: "The source moved the market to Sunday.",
    });
    expect(res.status).toBe(200);
    const fields = res.body.changes.map((c: any) => c.field);
    expect(fields).toEqual(expect.arrayContaining(["price", "times", "scan_ids", "created"]));
    // venue was sent with the same value, and description was not sent: neither is a change.
    expect(fields).not.toContain("venue");
    expect(fields).not.toContain("description");
    expect(res.body.description).toBe("Weekly farmers market with local food and crafts.");

    const price = res.body.changes.find((c: any) => c.field === "price");
    expect(price).toMatchObject({ old_value: null, new_value: "Free entry", actor: "agent", scan_id: changed.scan_id, reason: "The source moved the market to Sunday." });
    expect(res.body.times).toHaveLength(1);
    expect(res.body.times[0].rrule).toBe("FREQ=WEEKLY;BYDAY=SU");
    expect(res.body.scan_ids).toEqual([firstScan, changed.scan_id]);
    expect(res.body.review_state).toBe("published");

    const scan = await s.get(`/scans/${changed.scan_id}`);
    expect(scan.body).toMatchObject({ state: "processed", event_id: eventId, previous_event_id: eventId });

    const log = await s.get(`/events/${eventId}/changes`);
    expect(log.body.changes.at(-1).field).toBe("created");
  });

  it("ignores a scan with a reason", async () => {
    const other = await ingestOne(s, "stanford-fair", { title: "Stanford Village Fair" });
    const res = await s.post(`/scans/${other.scan_id}/ignore`, { reason: "Outside Hermanus: the venue is in Stanford." });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ state: "ignored", note: "Outside Hermanus: the venue is in Stanford." });
    expect(res.body.processed_at).toBeTruthy();
    expect((await s.get("/scans?state=pending")).body.count).toBe(0);
    expect((await s.post("/scans/missing/ignore", { reason: "Not here" })).status).toBe(404);
  });

  it("lists changes in the place since a date, newest first", async () => {
    const res = await s.get(`/changes?since=${encodeURIComponent(start)}`);
    expect(res.status).toBe(200);
    const fields = res.body.changes.map((c: any) => c.field);
    expect(fields.at(-1)).toBe("created");
    expect(fields).toContain("price");
    const times = res.body.changes.map((c: any) => c.changed_at);
    expect([...times].sort().reverse()).toEqual(times);

    expect((await s.get("/changes?since=2999-01-01")).body.changes).toEqual([]);
    expect((await s.get("/changes?since=yesterday")).status).toBe(400);
    expect((await s.get("/changes?since=2026-01-01&place=nowhere")).status).toBe(400);
  });
});
