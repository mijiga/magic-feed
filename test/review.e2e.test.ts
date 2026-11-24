import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

describe("review", () => {
  let s: TestServer;
  let lowId: string;
  let proposedId: string;

  beforeAll(async () => {
    s = await startServer();
  });
  afterAll(() => s.close());

  it("sends low confidence and proposed labels to the review queue", async () => {
    const a = await ingestOne(s, "maybe-market", { title: "Maybe a market" });
    const low = await s.post("/events", eventBody({ name: "Possible night market", confidence: 0.6, scan_ids: [a.scan_id] }));
    expect(low.status).toBe(201);
    expect(low.body.review_state).toBe("needs_review");
    expect(low.body.review_reasons).toEqual(["confidence 0.6 is below 0.8"]);
    lowId = low.body.id;

    await s.post("/vocabulary/proposals", { kind: "interests", term: "golf", reason: "Golf days and club tournaments" });
    const b = await ingestOne(s, "rugby", { title: "Hermanus Golf Club Open Day" });
    const proposed = await s.post(
      "/events",
      eventBody({ name: "Hermanus Golf Club Open Day", category: "festival", interests: ["golf"], scan_ids: [b.scan_id] }),
    );
    expect(proposed.body.review_state).toBe("needs_review");
    expect(proposed.body.review_reasons).toEqual(["uses proposed interest 'golf'"]);
    proposedId = proposed.body.id;

    const c = await ingestOne(s, "unknown-date", { title: "Some exhibition" });
    const unknown = await s.post(
      "/events",
      eventBody({
        name: "Undated exhibition",
        confidence: 0.5,
        times: [{ type: "continuous", start: null, end: null, precision: "unknown", rrule: null }],
        scan_ids: [c.scan_id],
      }),
    );
    expect(unknown.body.review_reasons).toHaveLength(2);

    const queue = await s.get("/review");
    expect(queue.body.count).toBe(3);
    expect(queue.body.events.map((e: any) => e.id)).toEqual([lowId, proposedId, unknown.body.id]);

    // The feed shows only published events by default.
    expect((await s.get("/events")).body.count).toBe(0);
    expect((await s.get("/events?review=needs_review")).body.count).toBe(3);
  });

  it("approves an event, publishes it and approves its proposed term", async () => {
    const res = await s.post(`/events/${proposedId}/review`, { decision: "approve", note: "Sport is a useful interest." });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ review_state: "published", review_reasons: [] });
    expect(res.body.changes[0]).toMatchObject({
      field: "review_state",
      old_value: "needs_review",
      new_value: "published",
      actor: "human",
      reason: "Sport is a useful interest.",
    });
    const vocab = await s.get("/vocabulary");
    expect(vocab.body.interests.find((t: any) => t.term === "golf").status).toBe("approved");

    const feed = await s.get("/events?interests=golf");
    expect(feed.body.events.map((e: any) => e.id)).toEqual([proposedId]);
  });

  it("rejects an event and keeps it rejected after a patch", async () => {
    const res = await s.post(`/events/${lowId}/review`, { decision: "reject", note: "Not a confirmed event." });
    expect(res.body.review_state).toBe("rejected");
    expect(res.body.changes[0]).toMatchObject({ actor: "human", new_value: "rejected" });

    const patched = await s.patch(`/events/${lowId}`, { confidence: 0.95, reason: "A second source confirms it." });
    expect(patched.body.review_state).toBe("rejected");

    const queue = await s.get("/review");
    expect(queue.body.count).toBe(1);
    expect((await s.post("/events/missing/review", { decision: "approve", note: "Looks fine" })).status).toBe(404);
  });

  it("publishes a needs_review event when a patch fixes the reason", async () => {
    const queue = await s.get("/review");
    const id = queue.body.events[0].id;
    const res = await s.patch(`/events/${id}`, { confidence: 0.9, reason: "The organiser confirmed the exhibition." });
    expect(res.body.review_state).toBe("published");
    expect(res.body.changes.map((c: any) => c.field)).toEqual(expect.arrayContaining(["confidence", "review_state"]));
    expect((await s.get("/review")).body.count).toBe(0);
  });
});
