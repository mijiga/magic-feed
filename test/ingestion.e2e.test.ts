import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

describe("ingestion", () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  });
  afterAll(() => s.close());

  const raw = { title: "Country Market", day: "Saturday", tags: ["food", "craft"], venue: { name: "Cricket Club" } };

  it("rejects an unknown source", async () => {
    const res = await s.post("/scans", { source_id: "nope", items: [{ external_id: "1", url: null, raw }] });
    expect(res.status).toBe(400);
    expect(res.body.details.allowed).toEqual(["village-news"]);
  });

  it("creates, then reports unchanged, then reports changed", async () => {
    const created = await ingestOne(s, "market-1", raw, "https://example.com/market");
    expect(created.outcome).toBe("created");

    const pending = await s.get("/scans?state=pending");
    expect(pending.body.scans.map((x: any) => x.id)).toContain(created.scan_id);
    expect(pending.body.scans[0].previous_event_id).toBeNull();

    const event = await s.post("/events", eventBody({ scan_ids: [created.scan_id] }));
    expect(event.status).toBe(201);
    const checkedBefore = event.body.last_checked;
    await new Promise((r) => setTimeout(r, 10));

    // Same content with keys in a different order hashes the same.
    const reordered = { venue: { name: "Cricket Club" }, tags: ["food", "craft"], day: "Saturday", title: "Country Market" };
    const unchanged = await ingestOne(s, "market-1", reordered, "https://example.com/market");
    expect(unchanged).toMatchObject({ outcome: "unchanged", scan_id: created.scan_id });

    const after = await s.get(`/events/${event.body.id}`);
    expect(after.body.last_checked > checkedBefore).toBe(true);
    expect(after.body.last_updated).toBe(event.body.last_updated);
    const scan = await s.get(`/scans/${created.scan_id}`);
    expect(scan.body.last_seen_at > scan.body.fetched_at).toBe(true);

    const changed = await ingestOne(s, "market-1", { ...raw, day: "Sunday" }, "https://example.com/market");
    expect(changed.outcome).toBe("changed");
    expect(changed.scan_id).not.toBe(created.scan_id);

    const queue = await s.get("/scans?state=pending");
    expect(queue.body.count).toBe(1);
    expect(queue.body.scans[0]).toMatchObject({ id: changed.scan_id, state: "pending", previous_event_id: event.body.id });
  });

  it("handles a batch of several items", async () => {
    const res = await s.post("/scans", {
      source_id: "village-news",
      items: [
        { external_id: "a", url: null, raw: { n: 1 } },
        { external_id: "b", url: null, raw: { n: 2 } },
        { external_id: "a", url: null, raw: { n: 1 } },
      ],
    });
    expect(res.body.results.map((r: any) => r.outcome)).toEqual(["created", "created", "unchanged"]);
  });
});
