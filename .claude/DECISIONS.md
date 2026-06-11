# Decisions Log

Settled decisions. Agents treat these as resolved — **do not re-litigate.** New entries follow the same format and get the next available `D-NNN` ID. Format and conflict-resolution protocol live in `.claude/CHARTER.md`.

Status values:
- **Locked** — settled. Charter constraints, public promises, or one-way doors. Re-opening requires an explicit user directive, not an agent's reweighting.
- **Provisional** — settled enough to act on, revisitable if a new constraint surfaces.

---

## D-001 · Brand name and spelling
**Decision:** The product and character are named **Geoffery** (nonstandard spelling, contains "offer": GE-OFFER-y). Logo may stylize as `GEOFFERy`; all body text uses "Geoffery"; the site never uses "Geoffrey" except one FAQ line explaining the spelling.
**Rationale:** Completes the GE/offer pun; SEO-ownable vs. the common name (Lyft/Tumblr pattern); distances from the minor OSRS NPC Geoffrey (flax farmer — name collision checked 2026-06, cleared: common given name, different spelling, entirely different original character; never reference flax/Seers' Village).
**Status:** Locked.

## D-002 · Primary domain and registrar
**Decision:** Register **geoffery.gg** at **Porkbun** (~$51/yr flat renewal). Do NOT purchase geoffery.com (premium, ~$4,088 — rejected). Register the standard-spelling redirect (`geoffrey.com`/`.gg` variant as available) and optionally one `askgeoffery`/`geofferys` variant, also at Porkbun (~$10–15 ea).
**Rationale:** GoDaddy quoted $99.99/yr — roughly double market; Porkbun is top-3 of 56 registrars on .gg registration, renewal, and 5-yr cost with flat renewals, free WHOIS redaction, free URL forwarding. Note: `.gg` is the Guernsey ccTLD — no full WHOIS privacy (redaction only); 60-day age + unlock required for future transfers.
**Status:** Locked. Action: purchase ASAP; domains precede everything.

## D-003 · DNS / CDN / hosting architecture
**Decision:** Registration stays at Porkbun; the site runs on **Cloudflare** (free tier): add `geoffery.gg` as a Cloudflare zone, point Porkbun nameservers at Cloudflare. All redirect domains added the same way; 301s to `geoffery.gg` implemented as Cloudflare redirect rules (not registrar forwarding). **Hosting default: Cloudflare Pages/Workers** unless the Ops agent documents a blocker.
**Rationale:** Cloudflare Registrar does not support the `.gg` TLD (confirmed 2026-06; no ETA), but Cloudflare DNS/CDN/SSL works with any registrar. This split is standard for `.gg` gaming sites. Verify nameserver propagation immediately after purchase before building against the domain (`.gg` registry-side nameserver issues occasionally reported).
**Status:** Locked.
**Compatibility note:** The local/qa/prod deployment split (D-012) layers cleanly on top — Cloudflare Access (Zero Trust) gates the qa subdomain to an email allowlist regardless of which Cloudflare origin (Pages, Workers, or Tunnel) ultimately serves the bytes.

## D-004 · Canonical URL & title architecture (one-way door)
**Decision:** Canonical host: `https://geoffery.gg`. Item pages: `/item/<slug>` with readable slugs (e.g. `/item/twisted-bow`), no IDs or query strings, never changed after launch. Title pattern: `<Item> GE price & deal rating — Geoffery`. H1 matches. Meta descriptions in Geoffery's voice but containing "OSRS", "Grand Exchange", "current price". All non-canonical domains and spellings 301 to canonical.
**Rationale:** Long-tail intent targeting ("X ge price", "is X worth buying osrs") where the wiki under-serves; URL stability is non-negotiable for SEO equity.
**Status:** Locked. Slug collision resolution: lowest-id item with a given name gets the bare slug; collisions get `-<id>` appended; assignment is stable across wiki updates (already implemented in `pipeline/src/geoffery_pipeline/collect.py`).

## D-005 · SEO program (growth-seo agent owns execution)
**Decision:** Programmatic SEO only — no blog, no editorial content. Requirements: sitemap with `lastmod` tied to real price movement; breadcrumb + FAQ schema (methodology page); internal linking via related/same-category items; Search Console verified at launch; OSRS tool-directory and wiki external-tools submissions; Core Web Vitals green by architecture (static/cached pages). Freshness (visible price/verdict/timestamp updates) is the crawl-priority lever. Expected ramp: 6–12 months.
**Status:** Locked.

## D-006 · Monetization model
**Decision:** Free forever (no account): all prices, charts, deal gauge, context flags — ad-supported, tame ads only (no autoplay video, no layout shift). Tips: Gold $1 / Platinum $10 / custom, one-time Stripe. Supporter ~$3/mo or ~$25/yr: ad-free, alerts, synced watchlists, rate-my-offer, badge. Patron ~$8/mo: pure prestige/cosmetics. Public promise: **nothing currently free ever moves behind the wall.** No dark patterns; one-click cancel; public how-we-make-money page.
**Status:** Locked. Supporter/Patron billing is post-MVP; launch is ads + tips only.

## D-007 · Exchange Ledger (donor wall) mechanics
**Decision:** One cumulative lifetime score across all support lanes. **Tiers (low → high): bronze → iron → steel → black → mithril → adamant → rune → dragon** (eight generic-word tiers; original iconography, no sprite copying). Amounts never shown; within-tier order alphabetical/join-date. Launch with fixed exponential thresholds; switch to percentile-based tiers (passive drift) once the ledger has a few hundred names — framed in-voice as Geoffery reorganizing the ledger. Monthly recalculation; demotions silent. Early supporters get a permanent "founding household" notation. Noisy early tiers are accepted as a momentum feature.
**Status:** Locked.

## D-008 · Character & IP guardrails
**Decision:** Geoffery is an original creature of ambiguous ancient species — ledger-keeper in waistcoat with pince-nez, quill, ledger. Dialogue presented in a portrait-left RPG dialogue panel of original design (explicitly NOT OSRS chatbox trade dress). Rule for all assets: **"rhyme, don't quote"** — no Jagex characters, names, sprites, fonts, or interface replication. Compliance agent reviews every outward-facing asset pre-commission and holds veto on Jagex/IP violations. Tip coin and tier art: generic fantasy metals in house style, labeled plainly ("Gold", "Platinum") — callbacks stay unspoken. Footer disclaimer: not affiliated with Jagex (full wording rendered from `web/src/content/geoffery-lines.json` → `footer_disclaimer`). If asked about the OSRS NPC Geoffrey: acknowledged only via one dry in-character no-relation line; no flax references in product copy.
**Status:** Locked.

## D-009 · Data sourcing
**Decision:** OSRS Wiki real-time prices API (`/latest` / `/5m` / `/1h` + `/mapping`) is the sole price source; Jagex news/RSS for event flags. Proper user-agent, rate-limit respect, attribution. No scraping outside community-blessed APIs. The collector starts before all other build work and gets day-one monitoring — history cannot be backfilled and the gauge needs 30+ days.
**Status:** Locked.

## D-010 · MVP scope boundary
**Decision:** MVP = item pages (search, prices, sparklines, deal gauge with unsettled state), mobile-first PWA, Geoffery dialogue component + ~25 core copy lines, tip jar, ledger page (fixed thresholds), methodology + money pages, tame ads, monitoring, **plus the Butler's Bell consultation engine (D-011): bell UI on every page, full buy/sell dialogue trees, recommendation engine, 2×2 market-regime classifier, accuracy scorer, backtest-published track record, soft daily meter.** Explicitly deferred: accounts, alerts, watchlists, Supporter/Patron billing, share cards, sentiment features, native app, percentile ledger, Discord anything, hard meter enforcement, unlimited-bell-for-supporters (slots into D-006 supporter billing when accounts ship).
**Status:** Locked.
**Amendment 2026-06-11:** Bell + consultation engine entered MVP scope; they are the differentiator (D-011 rationale). Launching without them ships another reference dashboard.

---

## D-011 · The Butler's Bell consultation (MVP differentiator)
**Decision:** The product's signature feature is a persistent, context-aware NPC-dialogue consultation in which Geoffery converts the user's intent (buy/sell) and time tolerance into a concrete recommended price, backed by a continuously measured accuracy record. Interface paradigm: competitors are dashboards (data the user must interpret); Geoffery is a conversation (intent in, answer out), rendered as an OSRS-native dialogue tree — a UI pattern the entire audience has pre-learned.

**Entry points (one tree, context-aware):**
- Bell is a fixed UI element on **every page** (top-right header inset; opens a dialog modal).
- From an item page: item context is pre-filled; dialogue opens at the buy/sell node ("Ah, the Twisted bow. Buying or selling, [sir]?").
- From any non-item page: dialogue opens one node earlier — "Which item shall we discuss?" — with item search rendered **inside** the dialogue panel. Search-as-dialogue makes the homepage's primary interaction and the consultation the same component.
- Every consultation **ends on the item page** with the recommendation displayed above the gauge/charts. Consultations deposit users onto ad-bearing, SEO-relevant pages; the reference layer and consultation layer reinforce each other.

**Dialogue trees:**
- **Buy branch:** item → "When do you need it?" → [Right now / I can wait a few hours / I can wait a long time] → recommendation.
- **Sell branch:** item → urgency framed around the coin, not the goods ("How swiftly does sir require the gold?") → same three tolerance classes → recommendation. The sell branch uses **distinct language throughout**; Geoffery may be knowing about urgent sales.
- **Recommendation node** includes: recommended price (rounded), measured fill confidence in character ("Offers so placed have filled nine times in ten within the hour"), market-state coloring from the regime.

**Market-state characterization (2×2 regime):**
- **Power axis:** buyer's market vs. seller's market (price trend + spread asymmetry).
- **Stability axis:** steady vs. volatile (volatility/volume z-score against the item's own baseline; generalization of the prior "unsettled" flag — "volatile" is its replacement).
- Regime colors Geoffery's advice ("A seller's market, and a volatile one — patience may not be rewarded this week") and feeds the recommendation engine's calibration buckets.

**Recommendation engine:**
- Targets a **fill probability**, not a best price. Indicative targets: 95% (instant), 85% (hours), 75% (patient) — tunable per tolerance × liquidity × regime.
- Implementation: instant ≈ current insta-buy/sell; hours ≈ percentile of recent fill distribution (p20 buy / p80 sell, regime-adjusted); patient ≈ favorable band edge (p10 / p90, liquidity-adjusted) — all derived from existing collector aggregates.

**Price rounding rule (binding, product-wide):**
- All recommended prices round to **no more than 4 significant figures** (1,594,231 → 1,594,000; 23,847 → 23,850).
- Rounding direction favors fill: **buys round up, sells round down** to the nearest 4-sig-fig step.
- The accuracy scorer evaluates the rounded price as shown to the user, never the internal unrounded value.
- Rule applies to recommended/suggested prices everywhere; live market data on item pages may remain exact.

**Accuracy ledger (the moat):**
- Every consultation logs a falsifiable prediction at the moment it is given: item, side, rounded recommended price, tolerance class, timestamp, regime label.
- A scorer evaluates each prediction against subsequent wiki 5-minute data: did the price series trade through the recommended level with nonzero volume within the tolerance window (indicative: instant ≈ immediate; hours ≈ 4–8h; patient ≈ 48–72h — tunable)? No user feedback required.
- Outcomes feed back into engine offsets (weekly calibration), surface as in-dialogue confidence statements, and publish as a site-wide and per-item fill-rate track record on `/methodology`. The published record is the trust asset competitors cannot quickly replicate.
- **Cold start:** before launch, backtest the recommendation rules against the collector's accumulated history so Geoffery opens with a defensible record. This compounds the collector-first rule (D-009 / charter constraint 5).
- The accuracy log IS Geoffery's ledger. Character prop and feedback loop are the same object; copy treats them as such.

**Free allowance & metering (MVP, account-free):**
- Soft meter: 5 consultations/day tracked via localStorage. Trivially evadable; the limit's job at MVP is to establish the norm, not to enforce.
- Limit delivered in character ("I have attended sir thrice today. Even I must rest the quill.") and doubles as the natural in-context supporter prompt.
- Hard enforcement and unlimited-bell for supporters arrive with accounts post-MVP, per D-010's boundary. The consultation is a personal service, so paywalling unlimited access is fully consistent with the locked "free = the market, paid = you" model (D-006). The reference layer remains free forever.

**Affected agents:** algorithms (recommendation engine, regime classifier, scorer, calibration, rounding), frontend (bell, dialogue component with embedded search, ends-on-item-page flow, soft meter), design-character (full buy/sell tree copy with distinct sell-branch language, regime descriptors, limit-reached lines, confidence phrasing), data-engineer (consultation log, prediction outcomes, regime snapshots), monetization (limit as supporter prompt, unlimited-bell as benefit).
**Status:** Locked. The consultation engine, accuracy scorer, regime classifier, bell UI, and dialogue component are the MVP differentiator.

## D-012 · Prescriptiveness amendment ("prescriptive only where measured")
**Decision:** The previously-locked principle "descriptive, never prescriptive" (algorithms agent prime directive) is amended to **"prescriptive only where measured."** Geoffery may say "I recommend X" if and only if that class of recommendation is logged, scored, and has a published fill rate; the measured record is what earns the right to recommend. The butler framing preserves the social contract (a butler advises; the master decides), and the user's tolerance choice preserves their agency in the outcome. Unmeasured judgments remain descriptive only (the deal gauge stays descriptive; the consultation's recommendation node becomes prescriptive once calibration has enough samples).
**Rationale:** Without measurement we'd be a guess; with measurement we're a butler. The amendment is conservative — it requires the moat (calibration data) to exist before allowing the prescriptive voice, and so it cannot be abused.
**Status:** Locked. Supersedes the prior version of the algorithms agent's prime directive.

## D-015 · Cloudflare Pages Functions + D1 for consultation logging
**Decision:** Live consultations log globally via a Cloudflare Pages Function (`/api/consult`) writing to Cloudflare D1. Same Cloudflare account already chosen for hosting per D-003; D1 is in-stack. Pages Functions are zero-additional-host (Pages already deploys the static site). Free tier covers expected MVP traffic (5 consultations/day × ~1k DAU at launch = ~5k writes/day, well inside D1's daily free quota).
**Rationale:** Without global logging, the published fill-rate track record is per-user-only — that defeats the moat. The Ops "additional moving parts" tax is paid because the feature IS the moat (D-011 rationale). Backtest seeds the track record at cold start; live logging compounds it after launch.
**Affected agents:** ops (adds D1 + Pages Function as managed moving parts; monitoring via Cloudflare dashboards), data-engineer (mirrors D1 schema locally for offline scoring), frontend (POSTs to `/api/consult` after each consultation).
**Status:** Locked. Sync direction: D1 is the source of truth for raw consultations; local pipeline pulls them for scoring; outcomes write back to D1; the static-site build reads aggregated calibration from local SQLite (already exported).

---

## Build-time decisions (added during implementation)

## D-011 · Implementation stack
**Decision:** Python + uv for the pipeline (collector, aggregates, news poller, exporter) writing to SQLite (WAL mode) at `data/geoffery.db`. Astro for the static-generated frontend reading JSON snapshots the pipeline exports to `web/src/content/generated/`. No request-path Python or SQL; the site is pure static HTML + a tiny client-side search index.
**Rationale:** Tie-breaker 1 (less ongoing maintenance) and 4 (cheaper). SQLite for a single-writer cron-driven pipeline is set-and-forget; Astro static-generates all ~4,600 item pages at build time so request-path is pure CDN. One DB file is trivially backed up — D-009's irreplaceable-raw-history requirement is satisfied. Python `httpx`/stdlib is the boring choice for ETL.
**Affected agents:** data-engineer, frontend, ops.
**Status:** Locked (storage choice reversible while the dataset is small; URL and DB schema are the one-way doors riding on it).

## D-012 · Deployment posture: local / qa / prod
**Decision:** Three deployments with code-path identical between them; the only differences are the env file sourced and the `GEOFFERY_DEPLOYMENT_NAME` label. Dispatched by `scripts/run.sh <env> <cmd>`. qa is hidden from the public via Cloudflare Access (Zero Trust) gating the qa subdomain to an email allowlist; `<meta robots noindex,nofollow>` + `robots.txt` deny-all + omitted canonical from non-prod are belt-and-suspenders. Live Stripe URLs structurally refuse to render outside `DEPLOYMENT_NAME=prod`. Per-deploy cache-bust via `GEOFFERY_BUILD_VERSION` derived from `git rev-parse --short HEAD`. Borrowed from dexter-dev's `DEXTER_DEPLOYMENT_NAME` pattern.
**Rationale:** Tie-breaker 1 (less maintenance — "works in qa ⇒ works in prod" eliminates a class of "but it worked locally" bugs at the cost of one extra env file) and 3 (easier to reverse — qa is the place to verify a wiki API change or a gauge tuning without burning prod history).
**Affected agents:** ops, frontend, data-engineer, monetization.
**Status:** Locked. Stacks cleanly under D-003's Cloudflare Pages/Workers default — Access gating is per-subdomain regardless of origin.
**Follow-ons:** owner sets up Cloudflare Access on the qa subdomain (see `docs/deployments.md`); prod tip jar fills only after Stripe Payment Links are created.

## D-014 · Chrome URL naming convention
**Decision:** Static-page URLs match their nav label, lower-cased, one word where possible: `/ledger`, `/methodology`, `/wages`, `/about`. No prepositions, no full-sentence URLs. Per D-004 every non-canonical URL 301s to the canonical one; this rule applies to chrome pages as well as items.
**Rationale:** Consistency between nav text and URL is a small UX moat — users predict the URL from the label and vice versa. Also reduces the surface area of brand language (single nouns are easier to share, link to, and remember than verb-phrase URLs like `/how-we-rate`).
**Status:** Locked.
**Affected agents:** frontend, growth-seo.
**Migration:** Old URLs (`/how-we-rate`, `/how-we-make-money`) 301 to new (`/methodology`, `/wages`) at three layers: Astro `redirects` config (HTTP 301 at the server), Cloudflare Pages `_redirects` file (true 301 at the edge in prod), and an HTML meta-refresh fallback. Service worker shell paths bumped to v2 to invalidate stale caches.

## D-013 · Repo layout
**Decision:** Source-of-truth files live where their primary readers live. Agent material (`.claude/CHARTER.md`, `.claude/DECISIONS.md`, agent prompts, dispatch rules, proposals) is under `.claude/`. User-facing docs (`design-spec.md`, `deployments.md`) under `docs/`. Repo root carries only what humans skim regularly: `README.md`, `CHANGELOG.md`, `.gitignore`. Code in `pipeline/` and `web/`; env templates in `env/`; operator notes in `local/` (gitignored).
**Rationale:** Discoverability — agents find load-bearing rules next to their own prompts; humans find context next to the README.
**Status:** Locked (trivially reversible).
