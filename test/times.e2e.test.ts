import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

describe("times", () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  });
  afterAll(() => s.close());

  it("accepts a one-off time without an rrule key", async () => {
    const scan = await ingestOne(s, "one-off", { title: "Jingle Bell Rock" });
    const res = await s.post(
      "/events",
      eventBody({
        name: "Jingle Bell Rock",
        times: [{ type: "one_off", start: "2026-12-03T18:00", end: null, precision: "exact" }],
        scan_ids: [scan.scan_id],
      }),
    );
    expect(res.status).toBe(201);
    expect(res.body.times[0].rrule).toBeNull();
  });
});
