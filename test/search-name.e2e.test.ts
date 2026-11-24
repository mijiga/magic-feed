import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eventBody, ingestOne, startServer, type TestServer } from "./server.js";

// Reproduces the live run: a market description named the art walk, so q matched the wrong event.
describe("search by name", () => {
  let s: TestServer;
  const names = async (query: string) => (await s.get(`/events?review=any&${query}`)).body.events.map((e: any) => e.name);

  beforeAll(async () => {
    s = await startServer();
    const walk = await ingestOne(s, "walk", { title: "First Fridays Art Walk" });
    await s.post("/events", eventBody({ name: "First Fridays Art Walk", description: "Galleries stay open late.", scan_ids: [walk.scan_id] }));
    const market = await ingestOne(s, "market", { title: "Lemm's Corner Market" });
    await s.post(
      "/events",
      eventBody({
        name: "Lemm’s Corner Market",
        description: "A market near the route of the First Fridays Art Walk.",
        scan_ids: [market.scan_id],
      }),
    );
    const cuvee = await ingestOne(s, "cuvee", { title: "Cuvée Weekends" });
    await s.post("/events", eventBody({ name: "Cuvée Weekends", scan_ids: [cuvee.scan_id] }));
  });
  afterAll(() => s.close());

  it("q still matches descriptions", async () => {
    expect(await names(`q=${encodeURIComponent("First Fridays Art Walk")}`)).toEqual(
      expect.arrayContaining(["First Fridays Art Walk", "Lemm’s Corner Market"]),
    );
  });

  it("name matches only the event name, with words in any order", async () => {
    expect(await names(`name=${encodeURIComponent("First Fridays Art Walk")}`)).toEqual(["First Fridays Art Walk"]);
    expect(await names(`name=${encodeURIComponent("art walk fridays")}`)).toEqual(["First Fridays Art Walk"]);
  });

  it("name ignores case, accents and punctuation", async () => {
    expect(await names(`name=${encodeURIComponent("lemm's corner")}`)).toEqual(["Lemm’s Corner Market"]);
    expect(await names(`name=${encodeURIComponent("CUVEE")}`)).toEqual(["Cuvée Weekends"]);
  });
});
