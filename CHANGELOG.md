# Geoffery System Changelog

Newest entries at the top. Every change ships with one entry — see `.claude/prompts.md` "CHANGELOG discipline" for the format and rules. Each entry corresponds to one git commit.

---

## 2026-06-11 — data-engineer + algorithms + frontend + design-character — SCOPE: CROSS-MODULE
**Summary**: D-013 News Context Layer ships. Replaces the RSS keyword matcher with **MediaWiki API polling** + **Claude Haiku** item-affection classifier. New module `wiki_news.py` fetches `Upcoming_updates`, `Updates`, and the current-year wiki page via the OSRS Wiki MediaWiki API; splits each page's wikitext into section-shaped updates; upserts into a new `wiki_updates` table. New module `news_classifier.py` ranks each unclassified update against the closed item vocabulary using Claude Haiku — model selects items verbatim from the catalog only, returns confidence + justification quote per association — and writes to `update_item_associations`. **Graceful stub mode** when `ANTHROPIC_API_KEY` is absent or the SDK isn't installed: the run logs "stub mode" and writes nothing. Display surfaces (frontend): `WikiUpdateNotice.astro` panel on the item page renders neutral disclaimers ("This recent update may affect this item" / "An upcoming update may affect this item") with a provenance link to the wiki article — never directional, never advisory. Geoffery's canonical neutrality line ("I keep accounts, sir. I do not gamble.") sits at the bottom of the notice block. **Firewalled from the recommendation engine** (D-012). Live verified: 31 wiki updates ingested (21 upcoming + 9 recent + 1 from /w/2026). Classifier in stub mode: 31 pending; the moment a Haiku key is set, those classifications populate and the item-page notices light up. The RSS news matcher (`news_matcher.py`) is demoted to legacy fallback but kept wired during the transition.
**Pitfall logged:** The OSRS Wiki's API endpoint is `https://oldschool.runescape.wiki/api.php` (no `/w/` prefix) — `/w/api.php` 301s to a capitalized `/w/Api.php` that 404s. Found the hard way; URL pinned in the module.
**Files touched**:
- `pipeline/src/geoffery_pipeline/db.py` — `wiki_updates` + `update_item_associations` tables.
- `pipeline/src/geoffery_pipeline/wiki_news.py` — new module: MediaWiki API client + section parser + upsert.
- `pipeline/src/geoffery_pipeline/news_classifier.py` — new module: Haiku classifier with closed-vocab prompt + JSON-parsing + graceful stub mode.
- `pipeline/src/geoffery_pipeline/export.py` — `_build_wiki_update_notices_by_item` adds `wiki_update_notices` per item.
- `pipeline/pyproject.toml` — `anthropic>=0.40` dependency.
- `scripts/run.sh` — `wiki-news` and `news-classifier` commands.
- `web/src/lib/data.ts` — `WikiUpdateNotice` type; `Aggregate.wiki_update_notices`.
- `web/src/components/WikiUpdateNotice.astro` — new component (neutral phrasing + provenance link).
- `web/src/pages/item/[slug].astro` — renders notices above the gauge.
- `web/src/content/geoffery-lines.json` — five new lines: `wiki_notice_upcoming`, `wiki_notice_recent`, `wiki_notice_provenance`, `wiki_no_speculation`, `consult_news_acknowledged`.
- `.claude/agents/data-engineer.md` — D-013 ownership + RSS matcher demoted to legacy fallback.
**Affected agents**: data-engineer (initiator), algorithms (boundary check: update flags don't enter recommend.py), frontend (notice component + item-page render), design-character (neutrality copy + the canonical "I keep accounts" line), compliance (CC BY-NC-SA signal-not-republication enforcement), ops (one new scheduled job).
**Verification**: `./scripts/run.sh local wiki-news` → 31 updates ingested over 3 source pages; `./scripts/run.sh local news-classifier` → stub-mode log entry confirms no key → no classifications written. Build pending (export still running concurrently with the backtest); when key is added the notices light up live.
**Follow-on (operator action)**: set `ANTHROPIC_API_KEY` in `.env.local` for the next run; the classifier will then process the 31 pending updates.

## 2026-06-11 — product-lead — SCOPE: LOCAL
**Summary**: Folded four new product decisions from `local/D-013-…D-017-*.md` into `.claude/DECISIONS.md`, taking the canonical D-013…D-017 slots. Existing build-time decisions (Repo layout, Chrome URLs, Cloudflare D1) renumbered to D-018, D-019, D-020 to make room. D-014 is reserved for the future supporter-billing system that D-015/D-017 reference. New entries:
- **D-013 News Context Layer (wiki + Haiku).** Replaces the simple RSS keyword matcher (`news_matcher.py`) with daily MediaWiki API polling of `/w/Upcoming_updates`, `/w/Updates`, `/w/2026`. Each new update entry is classified ONCE by Claude Haiku against a closed item vocabulary; associations carry confidence + provenance quote. Display: chart event markers + item-page notices + in-consultation acknowledgments. **Firewalled from the recommendation engine** (D-012 — only-measured-is-prescriptive). CC BY-NC-SA signal-not-republication rule binding.
- **D-014 reserved** — supporter billing system (Stripe subscriptions, paid-through dates, plan management). Specified when accounts ship post-MVP.
- **D-015 Wage Balance Display & Tip Attribution.** Post-MVP "wages paid through X months" display in account header + dialogue. Binding pre-payment disclosure for the tip flow (carried at MVP in informational form): tips automatically purchase wage credit at $1 = 1 month when accounts ship; logged-out tips are gifts only. Anonymous tipping path stays one-click, equally styled.
- **D-016 Advertising Plan.** AdSense, Auto-Ads PERMANENTLY DISABLED. Three slots total, ever: item-mid + item-bottom + a single mobile in-content unit. Absolute ad-free zones: consultation dialogue, Patrons page, tip and payment flows. Gold sellers / RWT services / gambling / get-rich-quick blocked. Zero-CLS reserved containers (D-016c). Public policy on `/tip-jar` page in Geoffery's voice.
- **D-017 User Profile (lightweight, post-MVP).** Passwordless magic links + optional Google/Discord OAuth. Display name 12 chars (in-game limit). Ledger opt-out toggle. Honorific (sir/madam/custom). **Absence list:** no avatars, bios, public profile pages, RSN linking, social graph, DMs — each absence is a deliberate moderation-surface savings.
**Files touched**: `.claude/DECISIONS.md` (renumber + add five new entries); `.claude/agents/data-engineer.md` (consultation D-015 reference updated → D-020).
**Affected agents**: product-lead (initiator); algorithms (D-013 boundary), frontend (D-015/D-016 implementations), design-character (D-013/D-015 copy), data-engineer (D-013 wiki poller + D-017 schema), monetization (D-015/D-016 ownership), compliance (D-013/D-016 enforcement), ops (D-013 new cron job).
**Verification**: docs-only; existing 44 tests pass; build unchanged.

## 2026-06-11 — monetization + frontend + design-character — SCOPE: CROSS-MODULE
**Summary**: D-015 + D-016 land at MVP scope. (1) New `AdSlot.astro` component — reserved-dimension container with fixed `min-width`/`min-height` for **zero cumulative layout shift** per D-016c. Four kinds: `item-mid` (728×90 desktop, below the verdict), `item-bottom` (page-bottom on item pages), `mobile-only` (320×100, the single mobile in-content unit), `page-bottom` (single bottom unit reserved for methodology/tip-jar — not used yet). Item page now renders three AdSlots (`item-mid` + `mobile-only` + `item-bottom`) below the verdict and at page bottom. Body `data-supporter="1"` suppresses all slots via CSS for future supporter accounts (D-015/D-017). (2) `ads.txt` placeholder lands at `web/public/` so the deploy contract is settled before AdSense onboarding. (3) Tip jar `<dialog>` now carries the **D-015b binding disclosure** in informational form before the payment options: "When supporter accounts arrive, each $1 will buy one month of supporter service and earn a row in the Exchange Ledger. Until then, tips are received as gifts — remembered in the founding household, but not yet credited as wages." (4) `/tip-jar` page rewritten with the full public ad policy in Geoffery's voice — three slots, what's banned, gold-merchant block, ad-free zones, supporter suppression — per D-016g.
**Pitfall logged for future agents:** Astro's `slot=` attribute on a component invocation is reserved for named-slot *projection* and silently no-ops a `Props.slot` prop. The AdSlot component's prop is therefore named `kind`, not `slot`. Two builds were wasted finding this; the comment in `AdSlot.astro` flags it explicitly.
**Files touched**:
- `web/src/components/AdSlot.astro` — new component (with the `slot`/`kind` pitfall note).
- `web/src/pages/item/[slug].astro` — three AdSlot invocations.
- `web/src/components/TipJar.astro` — pre-payment disclosure paragraph.
- `web/src/pages/tip-jar.astro` — public ad policy block.
- `web/public/ads.txt` — new placeholder.
**Affected agents**: monetization (initiator), frontend (component build + supporter suppression hook), design-character (disclosure + policy copy in voice), compliance (ad-free-zones + category-block doc), ops (ads.txt placeholder).
**Verification**: `npm run build` → 4,578 pages; `grep` confirms three `<aside class="ad-slot">` containers per item page, one mid + one mobile + one bottom; tip-jar page renders the policy block; ads.txt served at `/ads.txt`. Build succeeds; no test impact (frontend-only).

---

## 2026-06-11 — frontend + design-character — SCOPE: CROSS-MODULE
**Summary**: Phase 4 of D-011 — the Butler's Bell ships. `Bell.astro` is a top-right header inset on every page (original rope-pull SVG, no Jagex sprite, per D-008). `Consultation.astro` is a `<dialog>` modal containing a small state machine over five nodes — `pick-item` (search-as-dialogue, reuses `/items.json`), `pick-side` (buy/sell), `pick-tolerance` (instant/hours/patient with side-specific button copy), `show-recommendation` (renders a side+tolerance-specific copy line with the regime descriptor and a calibrated confidence statement), and `limit-reached` (5-per-UTC-day soft meter in localStorage; doubles as the supporter prompt). When the bell is rung from an item page, `document.body.dataset.item*` is set by an inline script and the dialog skips `pick-item`. On `show-recommendation` the close button is a link to `/item/<slug>#consulted=<bucket>-<price>` so the item page's new `RecommendationPanel.astro` hydrates the same recommendation above the gauge for landing visitors. Copy added to `geoffery-lines.json`: 27 new lines covering greetings, both branches with distinct sell-branch language ("How swiftly does sir require the gold?"), all six recommendation templates, the four 2×2 regime descriptors, three confidence tiers (gated per D-012 on calibration `n_total ≥ 50`), soft-meter exhaustion + supporter hint, and the record-page intro. POST to `/api/consult` is fire-and-forget — it will hit the Cloudflare Pages Function in Phase 3; for now it silently 404s and the UX continues, which is the correct fail-open posture.
**Files touched**:
- `web/src/components/Bell.astro` — new component.
- `web/src/components/Consultation.astro` — new component (dialog + state machine + localStorage meter + edge POST).
- `web/src/components/RecommendationPanel.astro` — new component (hydrates from URL hash on /item/<slug>).
- `web/src/layouts/Base.astro` — Bell in header, Consultation in chrome footer, header reflowed.
- `web/src/pages/item/[slug].astro` — sets `<body>` data attributes; renders `RecommendationPanel` above the gauge.
- `web/src/lib/data.ts` — `Regime`, `Recommendations`, `Side`, `Tolerance` types; `Aggregate` extended.
- `web/src/content/geoffery-lines.json` — 27 new copy lines.
**Affected agents**: frontend (initiator, owns components), design-character (copy + bell SVG silhouette).
**Verification**: `npm run build` → 4,578 pages in 23.5s; spot-check confirms `<button id="bell-trigger">`, `<dialog id="consultation-panel">`, and the inline `document.body.dataset` script all present. Aggregates JSON now carries `regime` + `recommendations` for every item (twisted bow: instant_buy 1.558B → hours_buy 1.554B → patient_buy 1.551B; declining as patience grows, as designed).
**Follow-on**: Phase 3 wires `/api/consult` to Cloudflare D1; Phase 5 runs `backtest` to populate `/methodology-stats.json` so the confidence statement gets real numbers.

---

## 2026-06-11 — algorithms — SCOPE: LOCAL
**Summary**: Phase 2c of D-011 — the scorer and the cold-start backtest. `scorer.score_pending(conn)` walks every consultation whose tolerance window has elapsed but lacks an outcome row, scans `prices_5m` within the per-tolerance window (instant: 0–30 min; hours: 4–8 h; patient: 48–72 h), and decides whether the recommended level was crossed with nonzero volume on the user's side (buy → any `avg_low` ≤ rec with `low_vol > 0`; sell → any `avg_high` ≥ rec with `high_vol > 0`). Outcomes write to `consultation_outcomes`; `calibration` is re-tabulated per `confidence_bucket` after each scoring pass. `backtest.backtest(conn, …)` replays the same recommendation engine across the trailing 21 days at a 12-hour cadence and writes the synthetic fill rates straight into `calibration` so the methodology page reads from one table whether the data is live or backtest — engine version is pinned by D-011 so the blend is honest. Both modules exposed via `./scripts/run.sh <env> {scorer|backtest}`.
**Files touched**:
- `pipeline/src/geoffery_pipeline/scorer.py` — new module: `score_pending`, `recompute_calibration`, `_filled_within_window`, `WINDOWS` constants.
- `pipeline/src/geoffery_pipeline/backtest.py` — new module: synthetic-consultation replay across history.
- `pipeline/tests/test_scorer.py` — 6 tests pin buy/sell/no-volume/window-not-closed and per-bucket calibration tabulation.
- `scripts/run.sh` — `scorer` and `backtest` commands routed.
**Affected agents**: algorithms (owns the scorer + backtest).
**Verification**: `uv run pytest` → 44 pass (38 prior + 6). The backtest will run for real once the headless 30-day backfill completes (Phase 5).

---

## 2026-06-11 — algorithms + data-engineer — SCOPE: CROSS-MODULE
**Summary**: Phase 2b of D-011 — schema additions + aggregates wire-up. `aggregates` table gains ten new columns: `regime_power`, `regime_stability`, `liquidity_band`, six rounded `rec_<tolerance>_<side>` prices, and `engine_version`. Three new tables for the consultation log + scorer output + per-cohort calibration (`consultations`, `consultation_outcomes`, `calibration`) — schema mirrors the D1 schema at the edge so sync is byte-for-byte (D-015). Idempotent ALTER TABLE migrations added so existing DBs roll forward without surgery. `aggregates.compute_for_item` now invokes `regime.classify` + `regime.liquidity_band` + `recommend.recommend` after the gauge math, returning the six recommendation prices alongside the band. `export.export_aggregates` emits a new `regime` block and `recommendations` block per item, plus `engine_version`. Verified live: 4,572 items computed, regime distribution: 1,502 buyer/steady · 1,369 seller/steady · 1,006 balanced/steady · 53 seller/volatile · 40 buyer/volatile · 15 balanced/volatile. Twisted bow's six recommendations look right (instant_buy 1,558M > instant_sell 1,551M; hours_buy 1,554M < instant_buy as expected; patient_buy 1,551M < hours_buy as expected). All 38 unit tests still pass.
**Files touched**:
- `pipeline/src/geoffery_pipeline/db.py` — extended `aggregates` schema, three new tables, idempotent ALTER statements for existing DBs.
- `pipeline/src/geoffery_pipeline/aggregates.py` — `compute_for_item` returns regime + recommendations; `recompute_all` upserts the new columns.
- `pipeline/src/geoffery_pipeline/export.py` — emits the `regime` + `recommendations` + `engine_version` blocks per item.
**Affected agents**: algorithms (wires its modules into aggregates), data-engineer (owns the schema + new tables).
**Verification**: `uv run pytest` → 38 pass; `./scripts/run.sh local aggregates` populates the new columns for all items; sqlite spot-check confirms regime + six rounded recommendations on twisted-bow; regime distribution across all items is realistic.

---

## 2026-06-11 — algorithms — SCOPE: LOCAL
**Summary**: Phase 2a of D-011 — three pure pipeline helpers and their tests, with no schema or wiring changes yet. (1) `rounding.py`: `round_sig(value, sigs, direction)` + the convenience `round_for_side(value, side)` that rounds buys up and sells down at 4 sig figs (binding rule per D-011). (2) `regime.py`: `classify(rows, now)` returns a `RegimeResult` with `power` (`buyer|seller|balanced`, derived from a 3-day trend and spread-share asymmetry) and `stability` (`steady|volatile`, derived from a 30-day-baseline volatility z-score). Generalises the prior single-axis "unsettled" flag — "volatile" is its replacement. Plus `liquidity_band(volume_baseline)` for the `thick|medium|thin` classification the recommend engine consumes. (3) `recommend.py`: `recommend(side, tolerance, regime, liquidity, current_insta_*, recent_mids_sorted)` returns a `Recommendation` whose `price` has already passed through `round_for_side`. Instant = current insta side; hours = p20/p80 of the recent fill distribution; patient = p10/p90, with regime nudges (seller's market pushes buys up, volatile stability widens cushion on both sides) and liquidity widening on thin markets. All three modules are pure — no I/O, no DB — and pinned by 23 tests.
**Files touched**:
- `pipeline/src/geoffery_pipeline/rounding.py` — new module.
- `pipeline/src/geoffery_pipeline/regime.py` — new module (2×2 classifier + liquidity helper).
- `pipeline/src/geoffery_pipeline/recommend.py` — new module (the engine, `ENGINE_VERSION = 1` constant for calibration grouping).
- `pipeline/tests/test_rounding.py` — 9 tests pin examples from the spec and the buy-up / sell-down invariant.
- `pipeline/tests/test_regime.py` — 6 tests cover the 2×2 cells + liquidity bands.
- `pipeline/tests/test_recommend.py` — 8 tests cover instant/hours/patient × side, regime/liquidity nudges, and the universal 4-sig-fig invariant.
**Affected agents**: algorithms (owns all three modules).
**Verification**: `uv run pytest` → 38 pass (15 prior + 9 + 6 + 8). No site rebuild; helpers aren't called from anywhere yet — that wires up in Phase 2b.

---

## 2026-06-11 — product-lead — SCOPE: CROSS-MODULE
**Summary**: D-011 "The Butler's Bell" enters MVP scope as the product's differentiating feature. The bell is a fixed UI element on every page; clicking opens a consultation dialogue tree that converts user intent (buy/sell + time tolerance) into a concrete recommended price, backed by a continuously measured accuracy record. Companion decisions: D-012 amends the "descriptive, never prescriptive" rule to **"prescriptive only where measured"** — Geoffery may recommend when the recommendation class is logged, scored, and has a published fill rate. D-015 commits the implementation runtime to Cloudflare Pages Functions + D1 (already in-stack per D-003). D-010 is amended to include bell + consultation + regime classifier + scorer + backtest-published record in MVP. Five agent prompts updated to absorb their new responsibilities — algorithms (regime + recommend + scorer + 4-sig-fig rounding), frontend (Bell + Consultation dialog + Meter), design-character (full buy/sell trees with distinct sell-branch language + regime descriptors + limit copy), data-engineer (consultation + outcomes + calibration tables; D1 sync), monetization (limit as supporter prompt, unlimited bell as headline supporter benefit). This is governance only; Phase 2 (pipeline modules) and beyond land in subsequent commits.
**Files touched**:
- `.claude/DECISIONS.md` — D-010 amended; D-011, D-012, D-015 added.
- `.claude/agents/algorithms.md` — prime directive updated; new ownership of regime + recommend + scorer + rounding + backtest.
- `.claude/agents/frontend.md` — Bell + Consultation + Meter accountabilities; search-as-dialogue equivalence noted.
- `.claude/agents/design-character.md` — bell-icon discipline; consultation copy surface defined; sell-branch distinct-language rule + recommendation-gating rule per D-012.
- `.claude/agents/data-engineer.md` — consultation + outcomes + calibration + D1 sync; heartbeat extends to scorer + d1_sync jobs.
- `.claude/agents/monetization.md` — bell limit as supporter prompt; unlimited bell as supporter benefit.
**Affected agents**: product-lead (initiator), algorithms, frontend, design-character, data-engineer, monetization, ops (D-015 adds D1 + Functions as managed moving parts), compliance (bell icon IP review).
**Verification**: documentation surface only; no code, build, or behavior changed. Existing tests still pass. Plan file `/Users/evancastle/.claude/plans/in-this-folder-are-snuggly-melody.md` carries the implementation sequencing for Phases 2–5.

---

## 2026-06-11 — algorithms + data-engineer — SCOPE: CROSS-MODULE
**Summary**: News articles now influence the gauge **per item, not as a blanket**. New `news_matcher` module compiles one alternation regex over all sufficiently-distinctive item names (>=4 chars; common-noun denylist for "hat", "key", "log", "bar", "ring", etc.) and returns matched item IDs from arbitrary text. `news_poller` stores each article's plain-text `summary` and runs the matcher over `title+summary` to populate `affected_items_json` on each `news_events` row. Every poll re-runs the matcher over the full table so denylist or catalog changes propagate without a migration. `aggregates.recompute_all` now builds `{item_id: [news_event_id, ...]}` for the trailing news lookback and per-item flips to `unsettled` only when that specific item appears in the affected set; items unmentioned by recent news get real bands. `export.export_aggregates` hydrates `news_citations: [{title, url, published_at}, ...]` per item from the same lookback so the frontend can render the source articles directly under an unsettled gauge — "Why unsettled" panel on the item page (per the user's "citations are good if Geoffery uses them"). Sample band distribution after the change: `1,584 average · 1,134 good · 825 poor · 1,029 unsettled` (down from previously 100% unsettled because every news article was firing the blanket rule).
**Files touched**:
- `pipeline/src/geoffery_pipeline/db.py` — schema: `news_events.summary`, `news_events.affected_items_json`; idempotent ALTER migrations for existing DBs.
- `pipeline/src/geoffery_pipeline/news_matcher.py` — new module: builds regex, strips HTML, returns matched item IDs.
- `pipeline/src/geoffery_pipeline/news_poller.py` — store summary; run matcher on every insert; re-derive matches for all rows each poll.
- `pipeline/src/geoffery_pipeline/aggregates.py` — replace blanket `_has_recent_news` with per-item `_recent_news_by_item` map; per-item check in `recompute_all`.
- `pipeline/src/geoffery_pipeline/export.py` — `_build_news_citations_by_item` adds `news_citations` to each aggregate JSON entry.
- `pipeline/tests/test_news_matcher.py` — new: 11 tests pinning behaviour around denylist, word-boundary, length-filter, HTML stripping, longest-match preference.
- `web/src/lib/data.ts` — `NewsCitation` type added; `Aggregate.news_citations` typed.
- `web/src/pages/item/[slug].astro` — render "Why unsettled" panel with citations when present; suppress generic `recent_news` flag bullet when concrete citations exist; remove the global-news section (it was noise; per-item is the honest signal).
**Affected agents**: algorithms (initiator, owns the gauge rule), data-engineer (owns schema + poller), frontend (renders citations).
**Verification**: `uv run pytest` → 15 pass (11 matcher + 4 gauge). Live news poller stored real summaries and ran the matcher (0 hits — the current RSS entries are high-level event titles like "Summer Sweep-Up" that don't name specific items, which is the correct null result). Aggregates band distribution flipped from 100% unsettled to the realistic distribution above. Synthetic test entry mentioning "Twisted bow" (id 20997) verified end-to-end: only twisted-bow flipped to unsettled, its export carried `news_citations: [{title, url, published_at}]`, and the item page rendered the "Why unsettled" panel — then removed.
**Follow-on**: short summaries from the RSS feed mean many real updates won't trigger per-item matches. If/when this becomes a coverage problem, fetch and cache the full article body via the news URL and run the matcher over that — separate ingestion module, post-MVP.

---

## 2026-06-11 — design-character + frontend — SCOPE: LOCAL
**Summary**: Chrome housekeeping bundle. (1) Nav renamed and reordered: `Home` (new) · `Patrons` (was `Ledger`) · `Methodology` · `Tip jar` (was `Wages`). (2) Page files renamed via `git mv`: `ledger.astro` → `patrons.astro`, `wages.astro` → `tip-jar.astro`. (3) Redirects added at all three layers (Astro config, Cloudflare `_redirects`, meta-refresh fallback) so `/ledger`, `/wages`, `/how-we-make-money` all resolve to the new URLs. SW `VERSION` bumped to `v3` to invalidate stale shell caches. (4) `Tip jar` nav link no longer navigates — JS handler in `TipJar.astro` intercepts clicks on `a[href="/tip-jar"]` and opens the existing dialog, matching the bottom-right floating icon's behaviour. The `/tip-jar` page still renders for users without JS and for search engines. (5) Methodology page trimmed: removed the "When the figures are unsettled" enumeration, the "What Geoffery never does" list, and the "Sources" block — those reasons surface on the item page itself when the gauge is unsettled (the methodology page now just defines the four bands). (6) Added an agent-guidance section to `design-character.md` directing future agents to borrow heavily from the OSRS Wiki (https://oldschool.runescape.wiki/) — layout grammar (infobox-right + body-left), tabular density, editorial voice for non-Geoffery prose, internal-linking conventions. The wiki is community-owned (not Jagex) and our blessed price source (D-009), so its conventions sit inside the "rhyme, don't quote" rule.
**Files touched**:
- `web/src/pages/ledger.astro` → `web/src/pages/patrons.astro` (git mv).
- `web/src/pages/wages.astro` → `web/src/pages/tip-jar.astro` (git mv).
- `web/src/layouts/Base.astro` — nav reordered, `Home` added, labels updated.
- `web/src/components/TipJar.astro` — progressive-enhancement handler on `a[href="/tip-jar"]`.
- `web/astro.config.mjs` — `/ledger → /patrons`, `/wages → /tip-jar`, `/how-we-make-money → /tip-jar`.
- `web/public/_redirects` — same rules at the Cloudflare edge.
- `web/public/sw.js` — VERSION `v2 → v3`, SHELL paths updated.
- `web/src/pages/methodology.astro` — three sections removed.
- `.claude/agents/design-character.md` — new "Borrow heavily from the OSRS Wiki" section.
**Affected agents**: design-character (initiator), frontend, growth-seo.
**Verification**: `./scripts/run.sh prod build` succeeds; all five new chrome pages serve 200; old URLs serve a redirect to the new URL; nav renders Home / Patrons / Methodology / Tip jar in that order.

---

## 2026-06-11 — design-character + frontend — SCOPE: CROSS-MODULE
**Summary**: Palette overhaul to **OSRS Chatbox Modern**. Page chrome stays dark warm (#1f1d18) but content lives on flat aged-parchment panels (`--c-parchment` #dccba0) with dark stone borders and brick-red headings (`--c-parchment-red` #8c2b1f). Body ink on parchment is near-black with warm cast (`--c-parchment-ink` #1a1610); in-panel links are muted blue (#22468f). Gold accent recalibrated (`--c-accent` #c89a3c). Per the compliance rule (D-008, "rhyme don't quote"): colour system only, no paper texture, no stone-bevel border-image, no blackletter — the brick-red on cream + dark border carries the OSRS callback typographically. New `.panel` wrapper applied to body content on `/item/<slug>`, `/methodology`, `/wages`, `/ledger`, `/about`; the dialogue component is itself a parchment panel and carries the homepage. Reference assets the user supplied (Gemini-generated panel mock + close-up screenshot) committed alongside the change for future calibration. Supersedes the Editorial Ledger pass from earlier today.
**Files touched**:
- `web/src/styles/tokens.css` — new `--c-parchment*` family; page-chrome warm-dark recalibration; gold tweaked.
- `web/src/layouts/Base.astro` — chrome/nav/footer recoloured for the warm-dark page bg.
- `web/src/components/Dialogue.astro` — render as parchment panel with dark border and brick-red name.
- `web/src/components/Gauge.astro` — band/badge/marker colours retuned for AA contrast on parchment.
- `web/src/components/Sparkline.astro` — stroke uses `--c-parchment-red`.
- `web/src/components/TipJar.astro` — recalibrated coin/option chrome against new tokens.
- `web/src/pages/index.astro` — homepage adopts the parchment dialogue panel + recoloured cards.
- `web/src/pages/item/[slug].astro` — gauge/quote table/sparklines in a single parchment "ledger entry" panel.
- `web/src/pages/methodology.astro`, `wages.astro`, `ledger.astro`, `about.astro` — body content moved into `.panel`s.
- `assets/Gemini_Generated_Image_*.png`, `assets/Screenshot 2026-06-11 141556.png`, `assets/prompt_instructions.txt` — reference material the user supplied; commits for traceability.
**Affected agents**: design-character (initiator), frontend, compliance (passed: no textures, no blackletter, no Jagex fonts).
**Verification**: `./scripts/run.sh prod build` → 4,578 pages in 13.8s; preview at :4321 confirms all five chrome pages render (homepage 26 KB, item page 36 KB, ledger 21 KB, methodology 26 KB, about 25 KB); `.panel` present on every chrome page that needed it.

---

## 2026-06-11 — data-engineer — SCOPE: LOCAL
**Summary**: Added `pipeline/src/geoffery_pipeline/backfill.py` to fetch historical `/5m` buckets from the wiki API by walking the timestamp parameter backward from now. Idempotent (REPLACE INTO), resumable (`--resume` default — picks up from the oldest existing bucket so re-running a partial doesn't re-burn the rate budget), and wiki-polite (1 req/s sustained, 2s pause every 100 requests, descriptive User-Agent). The gauge uses a 30-day window, so without backfill every reading is "unsettled (thin-history)" until 30 calendar days of live collection accrue; with backfill, the gauges become real on day one. Exposed via `./scripts/run.sh <env> backfill --days N`.
**Files touched**:
- `pipeline/src/geoffery_pipeline/backfill.py` — new module.
- `scripts/run.sh` — `backfill` dispatcher command.
**Verification**: ran `./scripts/run.sh local backfill --days 1` → 268 requests, 391,548 rows written in ~6 min. Re-ran `aggregates` + sampled twisted-bow: 121 samples, p25/p50/p75 populated, current price computed at percentile 0.55 — the gauge math now resolves to a real band; the live `band='unsettled'` is the news-blanket rule (3 recent news entries within 3-day lookback) which is the designed behaviour until per-item category mapping lands.
**Follow-on**: owner runs `./scripts/run.sh local backfill --days 30` overnight (~2.4 hours at 1 req/s) to fill the full gauge window. Cron-jobbing this is unnecessary — backfill is one-shot; the live collector keeps history forward.

## 2026-06-11 — frontend + growth-seo — SCOPE: CROSS-MODULE
**Summary**: Renamed chrome URLs so they match their nav labels: `/how-we-rate` → `/methodology`, `/how-we-make-money` → `/wages`. Logged the convention as D-014. Old URLs 301 to new at three layers: Astro `redirects` config (HTTP 301 in preview/local), Cloudflare Pages `_redirects` (true 301 at the edge in prod), and an HTML meta-refresh as host-agnostic fallback. Service worker `VERSION` bumped to `v2` so stale shell caches with the old paths are invalidated on next visit.
**Files touched**:
- `web/src/pages/how-we-rate.astro` → `web/src/pages/methodology.astro` (via `git mv`).
- `web/src/pages/how-we-make-money.astro` → `web/src/pages/wages.astro` (via `git mv`).
- `web/src/layouts/Base.astro`, `web/src/pages/index.astro`, `web/src/pages/item/[slug].astro` — all internal links rewritten.
- `web/astro.config.mjs` — `redirects` map added.
- `web/public/_redirects` — new Cloudflare Pages-style 301 rules.
- `web/public/sw.js` — `VERSION = 'v2'`; shell paths updated.
- `.claude/DECISIONS.md` — D-014 added.
**Affected agents**: frontend (initiator), growth-seo, ops (cache busting).
**Verification**: `./scripts/run.sh prod build` succeeds; `curl -sI` against preview returns `200` for `/methodology`, `/wages`, `/ledger`, `/about` and `301` for `/how-we-rate`, `/how-we-make-money`; `404` for unknown paths.

## 2026-06-11 — design-character + frontend — SCOPE: CROSS-MODULE
**Summary**: Added an "Output discipline — do the work, don't explain it" section to the `design-character` agent prompt and a parallel "Output discipline — markup, not lecture" section to the `frontend` agent prompt. Both pin the same rule: state changes in one sentence in chat, no decorative comments in code explaining design intent, no app-text that lectures the user on the design. Then dispatched the `frontend-craftsman` consultant subagent to do a UI polish pass under the new guidance. Aesthetic direction committed to: **Editorial Ledger** — Swiss-influenced editorial typography on dark, display-serif at scale, hairline rules replacing card chrome, all-caps tracked eyebrows, brass accent reserved for the brand mark and live verdicts. Visible changes: homepage card grid became a numbered watchlist with tabular numerals; item page replaced four bordered quote-cards with a serif `dl` table over a single hairline; gauge lost its container box and reads as a typographic verdict over a 4px segmented rule; dialogue panel dropped the monogrammed-G placeholder for a quill-on-ledger glyph and shed its card chrome for top/bottom hairlines; `h2`s became tracked uppercase eyebrows; brand brass now reserved for hover.
**Files touched**:
- `.claude/agents/design-character.md` — appended "Output discipline" section.
- `.claude/agents/frontend.md` — appended "Output discipline" section.
- `web/src/styles/tokens.css` — display-serif stack, line-height + features, h2 as eyebrow, narrower content width, refined accent rules.
- `web/src/layouts/Base.astro` — tighter header, tracked-caps nav, refined env banner.
- `web/src/pages/index.astro` — watchlist replaces card grid.
- `web/src/pages/item/[slug].astro` — `<dl>` quote table; ledger-entry crumbs; colophon footer line.
- `web/src/components/Gauge.astro` — hairline-rule-only treatment; 4px segmented band.
- `web/src/components/Dialogue.astro` — new glyph; chromeless panel between hairlines.
**Affected agents**: design-character (initiator), frontend, product-lead (commit/push discipline applied).
**Verification**: `./scripts/run.sh prod build` → 4,578 pages in 6.9s; preview at :4321 shows homepage ~24 KB, item page ~32 KB; new structural markers (`<dl class="quote">`, `class="badge ui"`, watchlist) present in rendered output.

## 2026-06-11 — product-lead — SCOPE: CROSS-MODULE
**Summary**: Folded ten settled product decisions from a parallel Claude thread (`local/DECISIONS.md`) into `.claude/DECISIONS.md`, adopting that thread's `D-NNN` numbered-ID format so future references are stable. Six are genuinely new (brand-name spelling D-001, Porkbun registrar D-002, Cloudflare DNS/CDN/Pages D-003, programmatic-SEO program D-005, eight-tier ledger sequence D-007 including the previously-missing "black" tier, NPC Geoffrey collision-cleared D-008). Four overlap with what we already had — kept the parallel's tighter language. My three prior build-time decisions (stack, deployment split, repo layout) are preserved as D-011..D-013. Re-rendered the `growth-seo` and `ops` agent prompts to point at the now-settled D-002/D-003/D-004/D-005 with explicit "do not re-decide" guardrails — settled-decision pointers borrowed from the parallel thread's `growth-seo.md` and `ops.md`. Updated `web/src/content/ledger.json` to D-007's eight-tier sequence (`bronze → iron → steel → black → mithril → adamant → rune → dragon`); previously had seven. Added two copy lines + a small dialogue panel to `/about` answering the spelling FAQ and a dry no-relation line for the OSRS NPC Geoffrey (D-001 + D-008). Updated `local/launch-checklist.md` so the owner's punchlist reflects the now-concrete domain choices (Porkbun, not unspecified registrar; Cloudflare Pages, not Tunnel-by-default).
**Files touched**:
- `.claude/DECISIONS.md` — full rewrite into D-NNN format; D-001..D-013.
- `.claude/agents/growth-seo.md` — URL/title + domain bullets retitled "SETTLED" with D-NNN pointers; programmatic-SEO bullet expanded from D-005.
- `.claude/agents/ops.md` — new "Domain / DNS / hosting architecture — SETTLED" bullet citing D-002/D-003.
- `web/src/content/ledger.json` — inserted `black` tier between `steel` and `mithril`; updated header comment with D-007 pointer.
- `web/src/content/geoffery-lines.json` — added `npc_geoffrey_no_relation` and `spelling_faq_short` keys.
- `web/src/pages/about.astro` — added "A note on the spelling" + "Aren't you that flax farmer?" sections wired to the new copy lines.
- `local/launch-checklist.md` — domain/Cloudflare TODO concretized; trademark task collapsed into a status update.
**Affected agents**: product-lead (initiator, owns DECISIONS), growth-seo, ops, frontend, design-character.
**Verification**: `./scripts/run.sh prod build` succeeds in 8.1s; about page renders the new sections; ledger source shows 8 tiers (rendered-empty state is unchanged because no names are loaded yet).

## 2026-06-11 — product-lead — SCOPE: LOCAL
**Summary**: Agents now `git push` by default after committing. `.claude/prompts.md` renamed its section to "Commit + push discipline" and pinned the rules: `git push` no-args (uses tracked upstream `origin/main`), never `--force`, never `--no-verify`, retry once on transient failure then surface the error, do nothing if no upstream is tracked, never configure remotes on the user's behalf. `.claude/CHARTER.md` "Logging and commits" section retitled and aligned. The cache-bust + audit-trail value of CHANGELOG + git history only pays off when origin reflects HEAD; the prior "agent commits, user pushes" split was leaving the remote a step behind.
**Files touched**:
- `.claude/prompts.md` — "Commit discipline" → "Commit + push discipline"; full rule set rewritten.
- `.claude/CHARTER.md` — "Logging and commits" → "Logging, commits, and pushing"; bullet rewritten.
**Verification**: this commit is the dog food — it gets pushed.

## 2026-06-11 — product-lead — SCOPE: LOCAL
**Summary**: Moved `CHARTER.md` and `DECISIONS.md` from the repo root into `.claude/`, next to `prompts.md` and `agents/`. They are load-bearing agent material — every agent prompt reads the charter before acting and `product-lead` writes to decisions — so `.claude/` is their natural home. The repo root is now only files humans skim regularly (`README.md`, `CHANGELOG.md`). Every reference across agent prompts, prompts.md, proposals/README.md, README.md, and the charter's own text was rewritten to `.claude/CHARTER.md` / `.claude/DECISIONS.md` so future agents discover both regardless of which file they land in first. `git mv` preserved file history.
**Files touched**:
- `.claude/CHARTER.md`, `.claude/DECISIONS.md` — moved here via `git mv`.
- `.claude/prompts.md` — source-of-truth list updated to reflect new locations with a comment explaining why they live in `.claude/`.
- `.claude/agents/*.md` (×9) — bare `CHARTER.md` / `DECISIONS.md` references rewritten with the `.claude/` prefix.
- `.claude/proposals/README.md` — same rewrite.
- `README.md` — repo-layout ascii block updated; charter / decisions move into the `.claude/` subtree.
- `CHANGELOG.md` — this entry; retroactive seed entries also touched up where they named the old paths.
**Verification**: `grep -rE '(CHARTER|DECISIONS)\.md'` confirms every reference now resolves through `.claude/`; the only remaining bare names are inside the README ascii tree, which is intentional (labels in a directory listing, not paths).

## 2026-06-11 — product-lead — SCOPE: LOCAL
**Summary**: Made the agent workflow legible: added `.claude/prompts.md` as the top-level dispatch rules (repo purpose, agent table, routing, decision-making, CHANGELOG discipline, commit discipline, terminology, refuse/escalate triggers); amended every agent prompt + `.claude/CHARTER.md` to require a CHANGELOG entry per change with one commit per entry; surfaced both files in README. Future commits eat the dog food.
**Files touched**:
- `.claude/prompts.md` — new top-level dispatch rules.
- `.claude/CHARTER.md` — new "Logging and commits" section.
- `.claude/agents/{algorithms,compliance,data-engineer,design-character,frontend,growth-seo,monetization,ops,product-lead}.md` — appended `## Logging` section.
- `README.md` — surfaced `.claude/prompts.md` + `CHANGELOG.md` in the layout description.
**Verification**: `n/a` — documentation surface only; no code or build behavior changed.

## 2026-06-11 — frontend — SCOPE: LOCAL
**Summary**: Strengthened the Jagex non-affiliation disclaimer to the industry-standard "no way affiliated with, authorised, maintained, sponsored or endorsed by Jagex Limited or any of its affiliates or subsidiaries" wording. Single source: `web/src/content/geoffery-lines.json` → `footer_disclaimer`. Renders in every page footer plus an explicit panel at the bottom of `/about`.
**Files touched**:
- `web/src/content/geoffery-lines.json` — `footer_disclaimer` rewritten.
- `web/src/pages/about.astro` — added explicit disclaimer panel + `.disclaimer` style.
**Verification**: `./scripts/run.sh prod build`; `grep` for the new string in homepage / item-page / about-page artifacts confirms it lands in all three.

## 2026-06-11 — ops — SCOPE: LOCAL
**Summary**: `scripts/run.sh` is now the single verb-less serve script: `./scripts/run.sh <localhost|local|qa|prod>` defaults to `serve`. `localhost` runs `astro dev` (HMR, no build). `qa` / `prod` write a `web/dist/.build-stamp` of env+version+epoch, and `serve` rebuilds only if missing, env-mismatched, version-mismatched, or any source file newer than the stamp. Auto-installs `node_modules/` on first run.
**Files touched**:
- `scripts/run.sh` — `serve` command, `needs_rebuild`, stamp, `localhost` alias for `local`.
**Verification**: built dist/ fresh; `./scripts/run.sh qa serve` skipped build ("dist/ is fresh"); switching qa → prod triggered rebuild ("stamp env=qa, requested=prod"); `touch web/src/pages/index.astro` then prod serve triggered rebuild ("source newer than stamp"); `localhost serve` served `astro dev` with HMR.

---

## 2026-06-11 — retroactive seed — covers commit 93272e7

The two entries below describe work that landed in the repo's initial commit, before the CHANGELOG file existed. They're seeded here for continuity; from this commit forward, one entry maps 1:1 to one git commit.

## 2026-06-11 — ops — SCOPE: CROSS-MODULE
**Summary**: Replicated the dexter-dev local / qa / prod deployment split. One launcher (`scripts/run.sh <env> <cmd>`), three env-file templates under `env/`, `GEOFFERY_DEPLOYMENT_NAME` label that flows through pipeline (`config.py`, `export.py`) and Astro build (`astro.config.mjs`, `src/lib/env.ts`). qa is hidden four ways: Cloudflare Access (primary, owner-action), `<meta name="robots" content="noindex, nofollow">` on every page, `Disallow: /` robots.txt, omitted canonical (so accidental qa indexing can never consolidate into prod's rank). Live Stripe URLs structurally refuse to render outside `DEPLOYMENT_NAME=prod`, eliminating accidental real-money flow on qa. Top banner shows `LOCAL` / `QA` band on non-prod; absent on prod. Sitemap integration is enabled only on prod. `pipeline/launchd/install.sh <env>` namespaces jobs so qa and prod coexist on one host. Per-deploy cache-bust token (`GEOFFERY_BUILD_VERSION`) derived from `git rev-parse --short HEAD`, fallback `<env>-<unix>`.
**Files touched**:
- `scripts/run.sh` — new dispatcher.
- `env/.env.{local,qa,prod}.example`, `env/README.md` — env templates.
- `pipeline/src/geoffery_pipeline/config.py` — `DEPLOYMENT_NAME`, `is_prod()`, `is_local()`.
- `pipeline/src/geoffery_pipeline/export.py` — `deployment` in `meta.json`.
- `pipeline/launchd/{install.sh,com.geoffery.*.plist}` — env-aware plists.
- `web/astro.config.mjs` — `site` per env, sitemap on prod only.
- `web/src/lib/env.ts` — `deployment`, `isProd`, `robotsContent`, `buildVersion`.
- `web/src/layouts/Base.astro` — robots meta, conditional canonical/OG, env banner.
- `web/src/components/TipJar.astro` — refuses live URLs outside prod.
- `web/src/pages/robots.txt.ts` — deployment-aware robots.txt.
- `docs/deployments.md` — Cloudflare Access setup, behavior matrix.
- `.claude/agents/ops.md` — deployment posture section.
- `.claude/DECISIONS.md`, `README.md`, `pipeline/README.md` — updates.
- `.gitignore` — exclude all three filled env files.
**Affected agents**: ops (initiator), data-engineer, frontend, monetization.
**Verification**: built all three envs in sequence; verified robots/canonical/sitemap/banner/tip-jar matrix against the build matrix in `docs/deployments.md`; `uv run pytest` still passes 4/4.

## 2026-06-11 — product-lead — SCOPE: CROSS-MODULE
**Summary**: Initial Geoffery MVP. Repo scaffolded: `.claude/CHARTER.md`, `docs/design-spec.md`, eight agent prompts under `.claude/agents/`, `.claude/proposals/` for cross-module changes, `.claude/DECISIONS.md`. `pipeline/` (uv) runs the OSRS Wiki API collector, computes percentile-based deal-gauge aggregates, polls the OSRS news RSS, and exports JSON snapshots. `web/` (Astro) static-generates ~4,600 item pages + chrome (search, methodology, how-we-make-money, ledger, about, 404), with Geoffery dialogue component, tip jar dialog, PWA manifest + service worker. Charter constraint 5 honoured: collector lives before anything else.
**Files touched**: ~70 files across `.claude/`, `docs/`, `pipeline/`, `web/`, root.
**Affected agents**: all eight.
**Verification**: pipeline collected 4,572 items, 4,420 latest prices, 1,588 active 5m buckets; aggregates computed for all items (unsettled until 30d history accrues, as designed); news poller pulled 15 RSS entries; Astro build produced 4,578 pages in 7.4s; `uv run pytest` passes 4/4 (gauge math: thin-history / good / poor / news-forces-unsettled).
**Follow-on (owner)**: register `geoffery.gg` + `geoffrey.*` redirects; trademark / OSRS-tool collision search; install local launchd; commission character art via `design-character` brief; fill `.env.prod` with Stripe Payment Link URLs (in the editor, not in chat).
