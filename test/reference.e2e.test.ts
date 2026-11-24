import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startServer, type TestServer } from "./server.js";

describe("reference endpoints", () => {
  let s: TestServer;
  beforeAll(async () => {
    s = await startServer();
  });
  afterAll(() => s.close());

  it("returns the guide with the workflows", async () => {
    const { status, body } = await s.get("/");
    expect(status).toBe(200);
    expect(body.openapi).toBe("/openapi.json");
    expect(Object.keys(body.workflows)).toEqual(["ingest", "process", "plan a trip", "review"]);
    expect(body.workflows.ingest).toEqual(["GET /sources", "POST /scans"]);
  });

  it("lists places and sources", async () => {
    expect((await s.get("/places")).body.places.map((p: any) => p.id)).toEqual(["hermanus"]);
    expect((await s.get("/sources")).body.sources.map((p: any) => p.id)).toEqual(["village-news"]);
  });

  it("returns the seeded vocabulary as approved terms", async () => {
    const { body } = await s.get("/vocabulary");
    expect(body.category.map((t: any) => t.term)).toContain("market");
    expect(body.interests.every((t: any) => t.status === "approved")).toBe(true);
    expect(body.suitability.map((t: any) => t.term)).toEqual(["adults", "all ages"]);
  });

  it("proposes a term once", async () => {
    const first = await s.post("/vocabulary/proposals", { kind: "interests", term: "sport", reason: "Rugby matches" });
    expect(first.status).toBe(201);
    expect(first.body).toEqual({ kind: "interests", term: "sport", status: "proposed" });
    const again = await s.post("/vocabulary/proposals", { kind: "interests", term: "sport", reason: "Again" });
    expect(again.status).toBe(201);
    const { body } = await s.get("/vocabulary");
    expect(body.interests.filter((t: any) => t.term === "sport")).toHaveLength(1);
  });

  it("serves the OpenAPI document with every route", async () => {
    const { status, body } = await s.get("/openapi.json");
    expect(status).toBe(200);
    expect(Object.keys(body.paths)).toEqual(
      expect.arrayContaining(["/", "/scans", "/scans/{id}/ignore", "/events", "/events/{id}", "/events/{id}/review", "/changes", "/review"]),
    );
  });

  it("returns 400 with details for an invalid body and 404 for an unknown id", async () => {
    const bad = await s.post("/scans", { source_id: "village-news", items: [] });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBeTruthy();
    expect(Array.isArray(bad.body.details)).toBe(true);
    expect((await s.get("/scans/nope")).status).toBe(404);
    expect((await s.get("/events/nope")).status).toBe(404);
  });
});
