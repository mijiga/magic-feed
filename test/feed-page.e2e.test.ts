import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

describe("feed page", () => {
  let s: TestServer;
  const page = async (query = "") => {
    const res = await fetch(`${s.url}/feed${query}`);
    return { status: res.status, type: res.headers.get("content-type") ?? "", html: await res.text() };
  };

  beforeAll(async () => {
    s = await startServer();
    const market = await ingestOne(s, "market", { title: "Country Market" });
    await s.post("/events", eventBody({ scan_ids: [market.scan_id] }));
    const concert = await ingestOne(s, "concert", { title: "That 80s Show" });
    await s.post(
      "/events",
      eventBody({
        name: "That 80s Show",
        venue: "Benguela Cove",
        category: "concert",
        interests: ["music"],
        suitability: ["adults"],
        times: [{ type: "one_off", start: "2026-12-12T17:00", end: null, precision: "exact", rrule: null }],
        scan_ids: [concert.scan_id],
      }),
    );
    const unsure = await ingestOne(s, "unsure", { title: "Mystery Market" });
    await s.post("/events", eventBody({ name: "Mystery Market", confidence: 0.5, scan_ids: [unsure.scan_id] }));
  });
  afterAll(() => s.close());

  it("lists published events grouped by date with the default window", async () => {
    const { status, type, html } = await page();
    expect(status).toBe(200);
    expect(type).toContain("text/html");
    expect(html).toContain("Hermanus events");
    expect(html).toContain("Hermanus Country Market");
    expect(html).toContain("That 80s Show");
    expect(html).toContain("Sat, 12 Dec 2026");
    expect(html).not.toContain("Mystery Market");
  });

  it("filters by interests and suitability", async () => {
    const { html } = await page("?interests=music&suitability=adults");
    expect(html).toContain("That 80s Show");
    expect(html).not.toContain("Hermanus Country Market");
  });

  it("shows events that wait for review when asked", async () => {
    const { html } = await page("?review=needs_review");
    expect(html).toContain("Mystery Market");
    expect(html).toContain("needs review");
  });

  it("rejects a window that ends before it starts", async () => {
    const { status, html } = await page("?from=2026-12-20&to=2026-12-01");
    expect(status).toBe(400);
    expect(html).toContain("The From date is after the To date.");
  });

  it("serves the stylesheet", async () => {
    const res = await fetch(`${s.url}/feed/styles.css`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/css");
  });
});
