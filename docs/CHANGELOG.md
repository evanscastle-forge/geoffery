# Changelog

Newest entry on top. One entry per commit; format in `.claude/prompts.md`. The full per-commit
history is in `git log`; this file carries the human-readable summaries going forward.

## 2026-06-13 — core (+ db, web-app, design) — SCOPE: CROSS-MODULE
**Summary**: Recommendation-engine overhaul. Replaced the percentile-of-recent-mids heuristic with a
deterministic first-passage (barrier) fill-probability model: each wait class targets ≥90% fill
within its window via δ = Z_FILL·σ̂·√n on robust (scaled-MAD) log-volatility, adds a fourth
"extended" (~1-month) tolerance, folds in bounded volatility-scaled news sentiment (age-decayed,
±5% capped, never the sole signal), enforces strong monotonicity, clamps to the empirical 30-day
range, and short-circuits to "market is a fair offer" within ~1.5%. Storage reframed as a 30-day
cache (hard prune of `prices_5m` + the archive; the OSRS Wiki is the source of truth). Reverses
three binding pieces — the §6 news/price firewall, archive-as-source-of-truth, and the 3-tolerance
model. Cloudflare deploy wiring (`ops/run.sh` target dispatcher, `ops/wrangler/` configs, `env/`
templates, `worker.ts` entries + `workers/_shared/`) landed alongside.
**Files touched**: `packages/core/src/{offers,stats,types,gauge,scoring}.ts` (+ tests, − firewall.test.ts);
`packages/data/src/{schema,db,repo,archive}.ts`; `workers/{aggregator,news,consult}/src/handler.ts`;
`packages/content/src/lines.ts`; `site/src/{components/Bell.astro,scripts/bell.ts,lib/data.ts,pages/rec/[slug].json.ts}`;
`ops/scheduler/{export,run-once,prune.node}.ts`; `tools/{backtest/src/index.ts,check-core-purity.mjs}`;
`eslint.config.js`; `docs/{RECOMMENDATION-METHODOLOGY,README,RUNBOOK}.md`; `.claude/{CHARTER,prompts}.md`
+ `agents/core/timeseries-forecaster.md`; `SYSTEM_ARCHITECTURE.md`. Deploy wiring: `ops/run.sh`,
`ops/wrangler/`, `env/*.example`, `workers/*/src/worker.ts`, `workers/_shared/`, `package.json`,
`tsconfig.json`, `.gitignore`, `tools/check-repo-layout.mjs`.
**SYSTEM_ARCHITECTURE.md sections affected**: §1 (fleet +`core/timeseries-forecaster`), §2.1/§2.2/§2.7, §4 (invariants: 30-day cache + bounded sentiment).
**Notify** (CROSS-MODULE): design (Bell copy/flow), db (prune cadence + restore drill), core (scoring windows).
**Verification**: `npm run check` green (58 tests: monotonicity, fill-math, sentiment scaling+ceiling,
fair-price, empirical clamp, Φ/Φ⁻¹/robust-vol). Pipeline regenerated `engine_version=2` — 4,020 items
with extended offers, 2,440 fair-flagged, 0 monotonicity violations across 4,020. Prune dropped 777k
`prices_5m` rows + old archive files. Browser loop (1440×900 + 390×844): four tolerances incl. "A
really long time"; discounted (extended buy 58,930) and fair ("market is a fair offer … 60,750") both
render; clean console.

## 2026-06-13 — main session — SCOPE: LOCAL
**Summary**: Docs correctness audit. Made the committed repo self-contained — removed dangling
links to the owner's private (`local/`, gitignored) spec/decision docs by inlining the
symptom→owner routing table into `SYSTEM_ARCHITECTURE.md` §5 and rephrasing cross-references to
in-repo docs. Corrected stale facts: Geoffery is a human ledger-keeper (not a dwarf); the site
route list (FAQ removed, `/contact/` + `/profile/` added); `watchScore` added to the core API;
test count 44→52; clarified SALVAGE provenance points at the reference repo.
**Files touched**: `README.md`, `SYSTEM_ARCHITECTURE.md`, `.claude/{CHARTER.md,prompts.md,proposals/README.md}`,
`.claude/agents/{core,design,web-app,web-app/growth-seo}.md`, `docs/{README,CHANGELOG,OSRS-WIKI-STYLE,SALVAGE}.md`,
`tools/check-repo-layout.mjs`.
**SYSTEM_ARCHITECTURE.md sections affected**: §1 (intro, fleet), §2.1, §2.9, §4, new §5 (routing).
**Verification**: no committed file references the local-only docs; doc links resolve; route list
matches `site/src/pages/`; `npm run check` green.

## 2026-06-12 — all agents — SCOPE: CROSS-MODULE
**Summary**: Greenfield rebuild — replaced the Python `pipeline/` + Astro `web/` architecture with
an all-TypeScript monorepo (`packages/{core,data,content}`, `workers/*`, `site/`, `tools/`, `ops/`)
and the four-agent fleet. Layered on the product: action-first verdicts, the OSRS-chatbox dialogue
(Pixel Operator font, owner's portrait), the OSRS-Wiki-inspired design system with a de-valenced
verdict palette, a gender-neutral funny voice, the header-mounted bell, member/free stars, the
stubbed `/profile/`, and qualitative methodology.
**Files touched**: full tree (see `git log` `d6c280b`).
**SYSTEM_ARCHITECTURE.md sections affected**: all (new as-built document).
**Verification**: `npm run check` green (typecheck, lint, core-purity, repo-layout, 52 tests);
browser loop verified at 1440×900 and 390×844.
