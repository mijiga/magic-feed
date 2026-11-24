export const FEED_CSS = /* css */ `
:root {
  --bg: #f2f4f7;
  --surface: #ffffff;
  --ink: #131a22;
  --muted: #5b6676;
  --line: #d9dee5;
  --accent: #0b5f80;
  --accent-soft: #e2eef4;
  --warn: #9a5b00;
  --warn-soft: #fbefd9;
  --ok: #1d6b45;
  --ok-soft: #e1f1e8;
  --off: #7b8594;
  --off-soft: #eceff3;
  --bad: #a3262d;
  --bad-soft: #f8e3e4;
  --sans: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1419; --surface: #171d24; --ink: #e6ebf0; --muted: #96a2b1; --line: #29323d;
    --accent: #6cbfe0; --accent-soft: #15303c; --warn: #f0b25c; --warn-soft: #372a14;
    --ok: #6fd19b; --ok-soft: #15301f; --off: #8d97a5; --off-soft: #232b34; --bad: #f08a8f; --bad-soft: #3a1c1f;
    color-scheme: dark;
  }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.5 var(--sans); }
.wrap { max-width: 1120px; margin: 0 auto; padding-inline: 16px; }
.top { background: var(--surface); border-bottom: 1px solid var(--line); padding-block: 20px; }
h1 { margin: 0; font-size: 24px; font-weight: 600; }
.sub { margin: 4px 0 0; color: var(--muted); }
.layout { display: grid; grid-template-columns: 260px minmax(0, 1fr); gap: 28px; padding-block: 24px 64px; align-items: start; }
@media (max-width: 760px) { .layout { grid-template-columns: minmax(0, 1fr); } }

.filters { display: flex; flex-direction: column; gap: 16px; position: sticky; top: 16px; }
@media (max-width: 760px) { .filters { position: static; } }
.field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field span, legend { font-size: 12px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
input[type=date], input[type=search], select {
  font: inherit; font-size: 14px; color: var(--ink); background: var(--surface);
  border: 1px solid var(--line); border-radius: 6px; padding: 6px 8px; width: 100%; min-width: 0;
  transition: border-color .15s ease;
}
input:focus-visible, select:focus-visible, button:focus-visible, summary:focus-visible, a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
fieldset { border: 0; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
legend { width: 100%; margin-bottom: 6px; padding: 0; }
.check { display: inline-flex; }
.check input { position: absolute; opacity: 0; pointer-events: none; }
.check span {
  font-size: 13px; padding: 3px 10px; border-radius: 999px; border: 1px solid var(--line);
  background: var(--surface); cursor: pointer; transition: background-color .15s ease, border-color .15s ease, color .15s ease;
}
.check input:checked + span { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); }
.check input:focus-visible + span { outline: 2px solid var(--accent); outline-offset: 2px; }
.actions { display: flex; align-items: center; gap: 14px; }
button {
  font: inherit; font-weight: 500; background: var(--accent); color: var(--surface); border: 0;
  border-radius: 6px; padding: 8px 14px; cursor: pointer; transition: opacity .15s ease;
}
button:hover { opacity: .9; }
a { color: var(--accent); }

.results { display: flex; flex-direction: column; gap: 22px; min-width: 0; }
.day h2 { margin: 0 0 8px; font-size: 13px; font-weight: 600; letter-spacing: .04em; text-transform: uppercase; color: var(--muted); }
.events { list-style: none; margin: 0; padding: 0; background: var(--surface); border: 1px solid var(--line); border-radius: 8px; }
.event { display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 12px; padding: 14px 16px; border-top: 1px solid var(--line); }
.event:first-child { border-top: 0; }
.time { font-family: var(--mono); font-size: 13px; color: var(--muted); padding-top: 2px; font-variant-numeric: tabular-nums; }
.title-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
h3 { margin: 0; font-size: 16px; font-weight: 600; }
.meta { margin: 2px 0 8px; color: var(--muted); font-size: 14px; }
.pill { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--off-soft); color: var(--off); }
.status-upcoming { background: var(--accent-soft); color: var(--accent); }
.status-running { background: var(--ok-soft); color: var(--ok); }
.status-expected { background: var(--off-soft); color: var(--muted); }
.status-cancelled, .status-postponed { background: var(--bad-soft); color: var(--bad); }
.review-needs_review { background: var(--warn-soft); color: var(--warn); }
.review-rejected { background: var(--bad-soft); color: var(--bad); }
.labels { list-style: none; display: flex; flex-wrap: wrap; gap: 6px; margin: 0; padding: 0; }
.label { font-size: 12px; padding: 1px 8px; border: 1px solid var(--line); border-radius: 4px; color: var(--muted); }
.label.category { color: var(--ink); font-weight: 500; }
details { margin-top: 8px; font-size: 14px; }
summary { cursor: pointer; color: var(--accent); width: fit-content; }
details p { margin: 6px 0 0; }
.desc { max-width: 68ch; }
.reasons { color: var(--warn); }
.dates { color: var(--muted); }
.empty, .error { background: var(--surface); border: 1px solid var(--line); border-radius: 8px; padding: 24px; margin: 0; color: var(--muted); }
.error { color: var(--bad); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
`;
