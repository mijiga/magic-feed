import { mkdtempSync, rmSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serve, type ServerType } from "@hono/node-server";
import { createApp } from "../src/app.js";
import { openDb } from "../src/db/client.js";

export const TODAY = "2026-11-24";

export interface TestServer {
  url: string;
  get: <T = any>(path: string) => Promise<{ status: number; body: T }>;
  post: <T = any>(path: string, body: unknown) => Promise<{ status: number; body: T }>;
  patch: <T = any>(path: string, body: unknown) => Promise<{ status: number; body: T }>;
  close: () => Promise<void>;
}

/** Starts the real HTTP server on a free port with a fresh database file. */
export async function startServer(): Promise<TestServer> {
  const dir = mkdtempSync(join(tmpdir(), "magic-feed-"));
  const db = openDb(join(dir, "feed.db"));
  const app = createApp({ db, today: () => TODAY });
  const server: ServerType = await new Promise((resolve) => {
    const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
  });
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;

  const call = async (method: string, path: string, body?: unknown) => {
    const res = await fetch(url + path, {
      method,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  };

  return {
    url,
    get: (path) => call("GET", path),
    post: (path, body) => call("POST", path, body),
    patch: (path, body) => call("PATCH", path, body),
    close: async () => {
      await new Promise((resolve) => server.close(resolve));
      db.$client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

export function eventBody(overrides: Record<string, unknown> = {}) {
  return {
    name: "Hermanus Country Market",
    description: "Weekly farmers market with local food and crafts.",
    place_id: "hermanus",
    venue: "Hermanus Cricket Club",
    category: "market",
    interests: ["food", "shopping"],
    suitability: ["all ages"],
    confidence: 0.9,
    times: [
      {
        type: "recurring",
        start: "2026-01-03",
        end: null,
        precision: "exact",
        rrule: "FREQ=WEEKLY;BYDAY=SA",
        start_time: "08:30",
        end_time: "12:30",
      },
    ],
    ...overrides,
  };
}

export async function ingestOne(s: TestServer, externalId: string, raw: unknown, url: string | null = null) {
  const res = await s.post("/scans", { source_id: "village-news", items: [{ external_id: externalId, url, raw }] });
  return res.body.results[0] as { external_id: string; scan_id: string; outcome: string };
}
