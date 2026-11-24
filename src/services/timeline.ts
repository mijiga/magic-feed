import rrulePkg from "rrule";
import type { ComputedStatus, EventState, Occurrence, TimeInput } from "../domain/types.js";

const { RRule } = rrulePkg;

export const MAX_OCCURRENCES = 20;
const FAR_FUTURE = "9999-12-31";

export interface Window {
  from: string;
  to: string;
}

export function todayIn(timezone: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

export function addMonths(date: string, months: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export function resolveWindow(asOf: string, from?: string, to?: string): Window {
  const start = from ?? asOf;
  return { from: start, to: to ?? addMonths(start, 18) };
}

const MM = /^\d{2}$/;
const YYYY_MM = /^\d{4}-\d{2}$/;
const datePart = (s: string) => s.slice(0, 10);
const monthPart = (s: string) => s.slice(0, 7);
const withTime = (date: string, time: string | null) => (time ? `${date}T${time}` : date);

/** A fixed span of dates, or a season that repeats every year. */
type Span = { kind: "dates"; start: string; end: string } | { kind: "months"; start: string; end: string } | { kind: "season"; start: number; end: number };

function spanOf(t: TimeInput): Span | null {
  if (t.precision === "unknown" || !t.start) return null;
  if (MM.test(t.start)) {
    const end = t.end && MM.test(t.end) ? t.end : t.start;
    return { kind: "season", start: Number(t.start), end: Number(end) };
  }
  if (YYYY_MM.test(t.start)) {
    const end = t.end && YYYY_MM.test(t.end) ? t.end : t.start;
    return { kind: "months", start: t.start, end };
  }
  const openEnded = t.type === "continuous" || t.type === "recurring";
  const end = t.end ? datePart(t.end) : openEnded ? FAR_FUTURE : datePart(t.start);
  return { kind: "dates", start: datePart(t.start), end };
}

const inSeason = (month: number, s: { start: number; end: number }) =>
  s.start <= s.end ? month >= s.start && month <= s.end : month >= s.start || month <= s.end;

const pad = (n: number) => String(n).padStart(2, "0");

function seasonInstances(span: { start: number; end: number }, w: Window): Occurrence[] {
  const out: Occurrence[] = [];
  const fromMonth = monthPart(w.from);
  const toMonth = monthPart(w.to);
  const wraps = span.end < span.start;
  for (let y = Number(w.from.slice(0, 4)) - 1; y <= Number(w.to.slice(0, 4)); y++) {
    const start = `${y}-${pad(span.start)}`;
    const end = `${wraps ? y + 1 : y}-${pad(span.end)}`;
    if (start <= toMonth && end >= fromMonth) out.push({ start, end, precision: "month" });
  }
  return out;
}

function utc(date: string, time: string | null, endOfDay = false): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  if (time) {
    const [hh, mm] = time.split(":").map(Number) as [number, number];
    return new Date(Date.UTC(y, m - 1, d, hh, mm));
  }
  return endOfDay ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59)) : new Date(Date.UTC(y, m - 1, d));
}

export function parseRrule(rule: string) {
  return RRule.parseString(rule.replace(/^RRULE:/i, ""));
}

function recurringOccurrences(t: TimeInput, w: Window): { occurrences: Occurrence[]; truncated: boolean } {
  if (!t.start || !t.rrule) return { occurrences: [], truncated: false };
  const startTime = t.start_time ?? (t.start.length > 10 ? t.start.slice(11, 16) : null);
  const options = parseRrule(t.rrule);
  const until = t.end ? utc(datePart(t.end), null, true) : null;
  const rule = new RRule({
    ...options,
    dtstart: utc(datePart(t.start), startTime),
    until: options.until && until ? (options.until < until ? options.until : until) : (options.until ?? until),
  });
  const exceptions = new Set(t.exceptions);
  const windowEnd = utc(w.to, null, true);
  const occurrences: Occurrence[] = [];
  let cursor = utc(w.from, null);
  let inclusive = true;
  while (occurrences.length <= MAX_OCCURRENCES) {
    const next = rule.after(cursor, inclusive);
    if (!next || next > windowEnd) break;
    cursor = next;
    inclusive = false;
    const date = next.toISOString().slice(0, 10);
    if (exceptions.has(date)) continue;
    occurrences.push({
      start: withTime(date, startTime),
      end: t.end_time ? withTime(date, t.end_time) : null,
      precision: "exact",
    });
  }
  const truncated = occurrences.length > MAX_OCCURRENCES;
  return { occurrences: occurrences.slice(0, MAX_OCCURRENCES), truncated };
}

export function occurrencesOf(t: TimeInput, w: Window): { occurrences: Occurrence[]; truncated: boolean } {
  if (t.type === "recurring" && t.rrule && t.precision === "exact") return recurringOccurrences(t, w);
  const span = spanOf(t);
  if (!span) return { occurrences: [], truncated: false };
  if (span.kind === "season") return { occurrences: seasonInstances(span, w), truncated: false };
  if (span.kind === "months") {
    const hit = span.start <= monthPart(w.to) && span.end >= monthPart(w.from);
    return { occurrences: hit ? [{ start: span.start, end: span.end, precision: "month" }] : [], truncated: false };
  }
  if (span.start > w.to || span.end < w.from) return { occurrences: [], truncated: false };
  const start = t.start!.length > 10 ? t.start! : withTime(t.start!, t.start_time);
  const end = t.end ? (t.end.length > 10 ? t.end : withTime(t.end, t.end_time)) : null;
  return { occurrences: [{ start, end, precision: t.precision }], truncated: false };
}

/** Occurrences of all times of an event, sorted and capped. */
export function eventOccurrences(times: TimeInput[], w: Window): { occurrences: Occurrence[]; truncated: boolean } {
  let truncated = false;
  const all: Occurrence[] = [];
  for (const t of times) {
    const r = occurrencesOf(t, w);
    truncated ||= r.truncated;
    all.push(...r.occurrences);
  }
  all.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  return { occurrences: all.slice(0, MAX_OCCURRENCES), truncated: truncated || all.length > MAX_OCCURRENCES };
}

export const isUnknown = (t: TimeInput) => t.precision === "unknown" || !t.start;

function phase(t: TimeInput, asOf: string): "running" | "future" | "past" | "unknown" {
  const span = spanOf(t);
  if (!span) return "unknown";
  if (span.kind === "season") return inSeason(Number(asOf.slice(5, 7)), span) ? "running" : "future";
  const at = span.kind === "months" ? monthPart(asOf) : asOf;
  if (at < span.start) return "future";
  if (at > span.end) return "past";
  return "running";
}

export function computeStatus(state: EventState, times: TimeInput[], asOf: string): ComputedStatus {
  if (state === "cancelled" || state === "postponed") return state;
  const phases = times.map((t) => phase(t, asOf));
  if (phases.every((p) => p === "unknown")) return "expected";
  if (phases.includes("running")) return "running";
  if (phases.includes("future")) return "upcoming";
  // A finished time next to an undated one: the undated one is still likely to happen.
  if (phases.includes("unknown")) return "expected";
  return "finished";
}
