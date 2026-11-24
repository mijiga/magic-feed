import { afterAll, beforeAll, describe, expect, it } from "vitest";
import gold from "../gold/events.json" with { type: "json" };
import { ingestOne, startServer, type TestServer } from "./server.js";

type GoldEvent = (typeof gold.events)[number];

function priceText(price: GoldEvent["price"]): string | null {
  if (!price) return null;
  return price.map((p) => `${p.label}: R${p.amount} per ${p.per}`).join("; ");
}

function toEventInput(g: GoldEvent, scanId: string) {
  return {
    name: g.name,
    place_id: "hermanus",
    venue: g.venue,
    ...g.labels,
    confidence: 0.95,
    confidence_reason: "The gold set entry was checked by hand against the source.",
    price: priceText(g.price),
    ticket_sale_cutoff: g.ticket_sale_cutoff?.date ?? null,
    times: g.times.map((t) => ({
      type: t.type,
      start: t.start,
      end: t.end,
      precision: t.precision,
      rrule: t.rrule,
      exceptions: t.exceptions,
      start_time: t.hours?.start ?? null,
      end_time: t.hours?.end ?? null,
    })),
    scan_ids: [scanId],
  };
}

describe("gold set", () => {
  let s: TestServer;
  const ids = new Map<string, string>();
  const goldId = (eventId: string) => [...ids].find(([, v]) => v === eventId)?.[0];
  const search = async (query: string) => {
    const res = await s.get(`/events?${query}`);
    expect(res.status).toBe(200);
    return res.body.events.map((e: any) => goldId(e.id)) as string[];
  };

  beforeAll(async () => {
    s = await startServer();
    for (const g of gold.events) {
      const scan = await ingestOne(s, g.id, g, g.source_urls[0] ?? null);
      const res = await s.post("/events", toEventInput(g, scan.scan_id));
      expect(res.status, JSON.stringify(res.body)).toBe(201);
      expect(res.body.review_state).toBe("published");
      ids.set(g.id, res.body.id);
    }
  });
  afterAll(() => s.close());

  it("computes the status of every gold event on the gold date", async () => {
    expect(ids.size).toBe(9);
    for (const g of gold.events) {
      const res = await s.get(`/events/${ids.get(g.id)}?as_of=${gold.as_of}`);
      expect(res.body.status, g.id).toBe(g.status_as_of);
    }
  });

  it("returns the events in a mid-December window, with expected events last", async () => {
    expect(await search("from=2026-12-10&to=2026-12-20")).toEqual([
      "cuvee-weekends-2026",
      "that-80s-show-2026",
      "sculpture-legacy-walk",
      "sculpture-on-the-cliffs",
    ]);
    const res = await s.get("/events?from=2026-12-10&to=2026-12-20");
    const cuvee = res.body.events[0];
    expect(cuvee.occurrences).toEqual([
      { start: "2026-12-12T11:00", end: "2026-12-12T13:00", precision: "exact" },
      { start: "2026-12-13T11:00", end: "2026-12-13T13:00", precision: "exact" },
    ]);
    expect(res.body.events[1].occurrences).toEqual([{ start: "2026-12-12T17:00", end: null, precision: "exact" }]);
    expect(res.body.events[2].occurrences).toEqual([]);
  });

  it("finds the first-Sunday market in the first week of December only", async () => {
    const week = await search("from=2026-12-01&to=2026-12-07");
    expect(week).toContain("art-in-the-park");
    expect(week).not.toContain("southern-right-whale-season");
    const res = await s.get("/events?from=2026-12-01&to=2026-12-07");
    const art = res.body.events.find((e: any) => goldId(e.id) === "art-in-the-park");
    expect(art.occurrences).toEqual([{ start: "2026-12-06T10:00", end: "2026-12-06T14:00", precision: "exact" }]);
  });

  it("includes the whale season in July and not in December", async () => {
    const july = await s.get("/events?from=2027-07-01&to=2027-07-10");
    const july_ids = july.body.events.map((e: any) => goldId(e.id));
    expect(july_ids).toEqual(
      expect.arrayContaining(["southern-right-whale-season", "fynarts-festival-2027", "art-in-the-park"]),
    );
    expect(july_ids).not.toContain("cuvee-weekends-2026");
    const whale = july.body.events.find((e: any) => goldId(e.id) === "southern-right-whale-season");
    expect(whale.occurrences).toEqual([{ start: "2027-06", end: "2027-11", precision: "month" }]);
    expect(await search("from=2026-12-10&to=2026-12-20")).not.toContain("southern-right-whale-season");
  });

  it("filters by interests, suitability and status", async () => {
    expect(await search("interests=wildlife")).toEqual(["southern-right-whale-season"]);

    const adults = await s.get("/events?suitability=adults");
    expect(adults.body.events.every((e: any) => e.suitability.includes("adults"))).toBe(true);
    expect(adults.body.events.map((e: any) => goldId(e.id))).toEqual(["cuvee-weekends-2026", "that-80s-show-2026"]);

    expect(await search("status=finished")).toEqual(["fynarts-select-2026"]);
    expect(await search("category=exhibition")).toEqual(["sculpture-legacy-walk", "sculpture-on-the-cliffs"]);
  });

  it("caps occurrences at 20 and flags the truncation", async () => {
    const res = await s.get("/events?from=2026-01-01&to=2028-12-31&q=art%20in%20the%20park");
    expect(res.body.events[0].occurrences).toHaveLength(20);
    expect(res.body.events[0].occurrences_truncated).toBe(true);
  });

  it("rejects an unknown place", async () => {
    expect((await s.get("/events?place=atlantis")).status).toBe(400);
  });
});
