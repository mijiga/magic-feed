import { and, asc, eq } from "drizzle-orm";
import type { Conn, Db } from "../db/client.js";
import { places, terms } from "../db/schema.js";
import type { Place, Term, TermProposal, Vocabulary } from "../domain/types.js";
import { badRequest } from "./errors.js";

type Kind = Term["kind"];
const KINDS: Kind[] = ["category", "interests", "suitability"];
const SINGULAR: Record<Kind, string> = { category: "category", interests: "interest", suitability: "suitability" };

export function listPlaces(db: Db): Place[] {
  return db.select().from(places).orderBy(asc(places.id)).all();
}

export function requirePlace(db: Db, id: string): Place {
  const place = db.select().from(places).where(eq(places.id, id)).get();
  if (!place) throw badRequest(`Unknown place '${id}'`, { allowed: listPlaces(db).map((p) => p.id) });
  return place;
}

export function getVocabulary(db: Db): Vocabulary {
  const rows = db.select().from(terms).orderBy(asc(terms.kind), asc(terms.term)).all();
  const vocab: Vocabulary = { category: [], interests: [], suitability: [] };
  for (const r of rows) vocab[r.kind].push({ kind: r.kind, term: r.term, status: r.status });
  return vocab;
}

export function proposeTerm(db: Db, p: TermProposal): Term {
  const existing = db.select().from(terms).where(and(eq(terms.kind, p.kind), eq(terms.term, p.term))).get();
  if (existing) return { kind: existing.kind, term: existing.term, status: existing.status };
  db.insert(terms)
    .values({ kind: p.kind, term: p.term, status: "proposed", reason: p.reason, created_at: new Date().toISOString() })
    .run();
  return { kind: p.kind, term: p.term, status: "proposed" };
}

export interface LabelSet {
  category: string;
  interests: string[];
  suitability: string[];
}

const termsOf = (labels: LabelSet): Record<Kind, string[]> => ({
  category: [labels.category],
  interests: labels.interests,
  suitability: labels.suitability,
});

/** Throws 400 for unknown terms. Returns a review reason for each proposed term. */
export function checkLabels(db: Db, labels: LabelSet): string[] {
  const vocab = getVocabulary(db);
  const unknown: { field: Kind; unknown: string[]; allowed: string[] }[] = [];
  const reasons: string[] = [];
  for (const kind of KINDS) {
    const known = new Map(vocab[kind].map((t) => [t.term, t.status]));
    const used = termsOf(labels)[kind];
    const missing = used.filter((t) => !known.has(t));
    if (missing.length) unknown.push({ field: kind, unknown: missing, allowed: [...known.keys()] });
    for (const t of used) if (known.get(t) === "proposed") reasons.push(`uses proposed ${SINGULAR[kind]} '${t}'`);
  }
  if (unknown.length) {
    throw badRequest("Unknown labels. Use a term from GET /vocabulary or propose one with POST /vocabulary/proposals.", unknown);
  }
  return reasons;
}

export function approveTerms(db: Conn, labels: LabelSet) {
  const used = termsOf(labels);
  for (const kind of KINDS) {
    for (const term of used[kind]) {
      db.update(terms).set({ status: "approved" }).where(and(eq(terms.kind, kind), eq(terms.term, term))).run();
    }
  }
}
