import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/client.js";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

async function createWithLabel(s: TestServer, id: string, name: string, confidence: number) {
  const scan = await ingestOne(s, id, { title: name });
  const res = await s.post("/events", eventBody({ name, interests: ["golf"], confidence, confidence_reason: "The source names a golf club but no town.", scan_ids: [scan.scan_id] }));
  return res.body.id as string;
}

describe("review recheck after a review approves a term", () => {
  let s: TestServer;
  let onlyLabel: string;
  let lowConfidence: string;
  let rejected: string;

  beforeAll(async () => {
    s = await startServer();
    await s.post("/vocabulary/proposals", { kind: "interests", term: "golf", reason: "Golf days and club tournaments" });
    onlyLabel = await createWithLabel(s, "a", "Golf Club Open Day", 0.9);
    lowConfidence = await createWithLabel(s, "b", "Twilight Golf", 0.6);
    rejected = await createWithLabel(s, "c", "Members Golf Draw", 0.9);
    await s.post(`/events/${rejected}/review`, { decision: "reject", note: "Members only." });
    const approved = await createWithLabel(s, "d", "Whale Coast Golf Classic", 0.9);
    await s.post(`/events/${approved}/review`, { decision: "approve", note: "Golf is a valid interest." });
  });
  afterAll(() => s.close());

  it("publishes an event whose only reason was the approved term, and logs why", async () => {
    const { body } = await s.get(`/events/${onlyLabel}`);
    expect(body.review_state).toBe("published");
    expect(body.review_reasons).toEqual([]);
    expect(body.changes[0]).toMatchObject({ field: "review_state", old_value: "needs_review", new_value: "published", actor: "system" });
  });

  it("keeps a low confidence event in review with only the confidence reason", async () => {
    const { body } = await s.get(`/events/${lowConfidence}`);
    expect(body.review_state).toBe("needs_review");
    expect(body.review_reasons).toEqual(["confidence 0.6 is below 0.8: The source names a golf club but no town."]);
  });

  it("keeps a rejected event rejected", async () => {
    expect((await s.get(`/events/${rejected}`)).body.review_state).toBe("rejected");
  });
});

describe("review recheck when the seed vocabulary approves a term", () => {
  const dir = mkdtempSync(join(tmpdir(), "magic-feed-recheck-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("publishes the event when the server starts again", async () => {
    const path = join(dir, "feed.db");
    const start = async () => {
      const db = openDb(path);
      const app = createApp({ db, today: () => "2026-11-24" });
      const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
        const srv = serve({ fetch: app.fetch, port: 0 }, () => resolve(srv));
      });
      const url = `http://localhost:${(server.address() as AddressInfo).port}`;
      const close = async () => {
        await new Promise((resolve) => server.close(resolve));
        db.$client.close();
      };
      return { db, url, close };
    };
    const post = async (url: string, body: unknown) =>
      (await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })).json();

    const first = await start();
    first.db.$client.prepare("UPDATE terms SET status = 'proposed' WHERE kind = 'interests' AND term = 'film'").run();
    const scan = await post(`${first.url}/scans`, { source_id: "village-news", items: [{ external_id: "film", url: null, raw: { title: "Film night" } }] });
    const event = await post(`${first.url}/events`, eventBody({ name: "Film night", interests: ["film"], scan_ids: [scan.results[0].scan_id] }));
    expect(event.review_state).toBe("needs_review");
    await first.close();

    const second = await start();
    const after = await (await fetch(`${second.url}/events/${event.id}`)).json();
    await second.close();
    expect(after.review_state).toBe("published");
    expect(after.review_reasons).toEqual([]);
  });
});
