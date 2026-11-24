import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import { afterAll, describe, expect, it } from "vitest";
import gold from "../gold/events.json" with { type: "json" };
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/client.js";

describe("vocabulary seed", () => {
  const dir = mkdtempSync(join(tmpdir(), "magic-feed-vocab-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("approves a proposed term when the gold set vocabulary contains it", async () => {
    const path = join(dir, "feed.db");
    const first = openDb(path);
    first.$client.prepare("UPDATE terms SET status = 'proposed' WHERE kind = 'category' AND term = 'sport'").run();
    first.$client.close();

    const db = openDb(path);
    const app = createApp({ db, today: () => "2026-11-24" });
    const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
      const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
    });
    const port = (server.address() as AddressInfo).port;
    const vocab = await (await fetch(`http://localhost:${port}/vocabulary`)).json();
    await new Promise((resolve) => server.close(resolve));
    db.$client.close();

    expect(vocab.category).toContainEqual({ kind: "category", term: "sport", status: "approved" });
    for (const kind of ["category", "interests", "suitability"] as const) {
      const approved = vocab[kind].filter((t: any) => t.status === "approved").map((t: any) => t.term);
      expect(approved).toEqual(expect.arrayContaining(gold.vocabulary[kind]));
    }
  });
});
