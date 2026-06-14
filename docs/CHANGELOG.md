# Changelog

Newest entry on top. One entry per commit; format in `.claude/prompts.md`. The full per-commit
history is in `git log`; this file carries the human-readable summaries going forward.

## 2026-06-14 — web-app + design + core — SCOPE: CROSS-MODULE
**Summary**: Feedback batch (`local/feedback.txt`). (1) Persistent site search in the header on every
page (homepage keeps its hero search); (2) the Bell now ends with **Start Over** + **Visit Item Page**
instead of one verify link; (3) nav reordered to Home · Tip Geoffery · About; (4) **tips rethought** —
removed the Patrons page + Log in/profile; the Tip Geoffery page is now a monthly tip jar + a wall of the
month's patrons with a month picker (no rankings), reaching the goal grants every visitor bonus
consultations and a tipper unlimited use that month (cookie-driven; donor data is curated content; basic
profanity filter on names); (5) "Ring the bell" bolded on home; (6) larger card bottom margin so charts
aren't clipped; (7) sparkline plot inset so the % annotations have room. Revises the 2026-06-12
account-gated tip model (CHARTER §3).
**Files touched**: `site/src/layouts/Base.astro`; `site/src/components/{Search,Sparkline,Bell}.astro`;
`site/src/pages/{index,money,404,sitemap.xml}` + **deleted** `{ledger,profile}.astro`; `site/src/scripts/bell.ts`;
`packages/content/src/{lines,donations (new),index}.ts`; `packages/core/src/{profanity (new + test),index}.ts`;
`.claude/CHARTER.md`.
**SYSTEM_ARCHITECTURE.md sections affected**: none.
**Notify**: web-app/monetization (tip model), growth-seo (`/ledger/` + `/profile/` removed).
**Verification**: `npm run check` green (63 tests incl. new `cleanName`). Browser (1440×900 + 390×844):
header search on every non-home page; Bell shows Start Over + Visit Item Page; nav Home · Tip Geoffery ·
About; bold "Ring the bell"; card charts un-clipped + roomy annotations; Tip jar fills from the curated
total, the month picker switches the donor list, a tip sets the cookie. `/ledger/` + `/profile/` 404.

## 2026-06-13 — web-app + core + design — SCOPE: CROSS-MODULE
**Summary**: UI batch — (1) taller "items of note" cards with roomier weekly charts; (2) removed the
buy/hold/sell/wait verdict badges everywhere (homepage + item gauge); (3) the gauge verdict line is now
just the stat ("X% above/below the 30-day median.", no action word); (4) the item-page "Market" field is
a new **color-graded volatility badge** (steady / some volatility / highly volatile) from the 30-day IQR
spread; (5) removed the IQR "wander" note; (6) merged methodology + contact into one `/about/`; (7)
restyled Patrons as a colored metal-tier **scroll**, pre-populated + empty; (8) dropped the "pot of tea"
ring quip. Re-reverses the 2026-06-12 action-first verdict rule (CHARTER §5).
**Files touched**: `packages/core/src/{gauge,regime}.ts` (+ tests — stat-only `verdictText`, new
`volatilityLevel`); `packages/content/src/lines.ts` (`GAUGE.volatility`, −`iqrNote`, −quip, `PAGES.about`);
`site/src/pages/{index,item/[slug],about (new),ledger,sitemap.xml}` + **deleted** `{methodology,contact}.astro`;
`site/src/components/Gauge.astro`; `site/src/layouts/Base.astro` (nav → About); `.claude/CHARTER.md`.
**SYSTEM_ARCHITECTURE.md sections affected**: none.
**Notify**: db (`verdict_text` is stored — re-run aggregate+export to repopulate); growth-seo
(`/methodology/` + `/contact/` → `/about/`).
**Verification**: `npm run check` green (59 tests incl. `volatilityLevel` + updated verdict test).
Browser (1440×900 + 390×844): no badges, taller cards, stat-only verdict, color-graded volatility badge,
no wander note, `/about/` merged with About nav, `/ledger/` scroll. Pipeline re-run to regenerate verdicts.

## 2026-06-13 — web-app — SCOPE: LOCAL
**Summary**: Homepage "items of note" cards are now a uniform size — the item name is clamped to a
reserved 2-line block (ellipsis, with the full name on hover via `title`), so every header is the same
height and the price + weekly sparkline sit in the same place on every card. Fixes long names (e.g.
"Trailblazer reloaded rejuvenation pool scroll") wrapping to 3–4 lines and shoving the chart out of frame.
**Files touched**: `site/src/pages/index.astro` (card styles + `title` attr).
**SYSTEM_ARCHITECTURE.md sections affected**: none.
**Notify**: none.
**Verification**: chrome-devtools at 1440×900 / ~1000px / 390×844 — all cards identical height (154px),
headers uniform (61px), nothing clipped; long names truncate with "…". `npm run check` green.

## 2026-06-13 — design — SCOPE: LOCAL
**Summary**: Trend sparklines (item-page Recent-trend graphs + homepage item-of-note cards) now stroke
**green when the overall trend is up, red when down**, reverting the 2026-06-12 "no red on direction"
for trend lines only — the verdict chips + gauge bar stay non-red (a red line = "price fell", not a
verdict). House-mixed dark hues for parchment legibility.
**Files touched**: `packages/content/src/tokens.css` (`--trend-up` → green `#246b27`, `--trend-down` →
red `#b3261e` + comment), `site/src/components/Sparkline.astro` (comment only — `rising` logic
unchanged), `docs/OSRS-WIKI-STYLE.md` (new entry + reconciled the gauge entry).
**SYSTEM_ARCHITECTURE.md sections affected**: none.
**Notify**: none (these tokens are consumed only by `Sparkline.astro`).
**Verification**: chrome-devtools loop at 1440×900 + 390×844 — homepage cards + the three Recent-trend
graphs each colour by their own first-vs-last trend (green up / red down), legible on parchment.
In-browser AA on `--panel`: green 4.93:1, red 4.92:1. `npm run check` green.

## 2026-06-13 — design — SCOPE: LOCAL
**Summary**: Recolored the item-page deal-gauge bar to a monochromatic **gold→white** ramp (buy = gold,
sell = white) to kill the muddy amber→grey→teal midtone, and neutralized the "sell" side everywhere it
was teal — the Sell verdict chip (→ cool near-white, cool-bordered). Added `--gauge-buy`/`--gauge-sell`
tokens; `--teal` (waistcoat) untouched. (The trend sparkline's red/green is a separate entry above.)
**Files touched**: `packages/content/src/tokens.css` (new `--gauge-buy`/`--gauge-sell`;
`--poor`/`--poor-bg` retuned + comments), `site/src/components/Gauge.astro`
(`.gauge-track` gradient + crisp edge), `site/src/styles/global.css` (`.tag.poor` cool border),
`docs/OSRS-WIKI-STYLE.md` (rationale + values).
**SYSTEM_ARCHITECTURE.md sections affected**: none.
**Notify**: web-app (the gauge + sparkline consume these tokens).
**Verification**: chrome-devtools loop on item pages at 1440×900 + 390×844 across all four bands — bar
reads gold→white with a clean midpoint, white end crisp via the border; gold Buy chip vs near-white Sell
chip clearly distinct. In-browser AA: Sell text 9.75:1 on its chip. `npm run check` green.

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
