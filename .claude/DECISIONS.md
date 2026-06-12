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

## D-020 · Cloudflare Pages Functions + D1 for consultation logging (was D-015)
**Decision:** Live consultations log globally via a Cloudflare Pages Function (`/api/consult`) writing to Cloudflare D1. Same Cloudflare account already chosen for hosting per D-003; D1 is in-stack. Pages Functions are zero-additional-host (Pages already deploys the static site). Free tier covers expected MVP traffic (5 consultations/day × ~1k DAU at launch = ~5k writes/day, well inside D1's daily free quota).
**Rationale:** Without global logging, the published fill-rate track record is per-user-only — that defeats the moat. The Ops "additional moving parts" tax is paid because the feature IS the moat (D-011 rationale). Backtest seeds the track record at cold start; live logging compounds it after launch.
**Affected agents:** ops (adds D1 + Pages Function as managed moving parts; monitoring via Cloudflare dashboards), data-engineer (mirrors D1 schema locally for offline scoring), frontend (POSTs to `/api/consult` after each consultation).
**Status:** Locked. Sync direction: D1 is the source of truth for raw consultations; local pipeline pulls them for scoring; outcomes write back to D1; the static-site build reads aggregated calibration from local SQLite (already exported).

---

## D-013 · News & Update Context Layer (wiki + Haiku)
**Decision:** Item pages, charts, market-regime context, and consultations gain an automated **news context layer** explaining *why* prices move: game updates both **recent and upcoming**, surfaced as neutral, disclaimed annotations. Sourcing is the OSRS Wiki's update pages (https://oldschool.runescape.wiki/w/Upcoming_updates, /w/Updates, /w/2026, etc.) via the MediaWiki API — never HTML scraping. Classification is done once per new update entry by **Claude Haiku** against a closed-vocabulary item taxonomy; the model selects affected items only from the catalog and quotes the specific update line justifying each association. Daily poll (hourly on known game-update days). Cost expectation: pennies per month. **Supersedes** the simple RSS keyword matcher shipped earlier (`news_matcher.py`) — that matcher is retired or demoted to fallback. Display surfaces: chart event markers, item-page upcoming-update notices, in-consultation acknowledgments by Geoffery, regime-classifier input (recent-update is a volatility input only, never a price-direction input). **Boundary (binding):** update flags are context-only and never enter the recommendation engine — per D-012, prescription requires measurement, and update-speculation outcomes are unmeasurable in the fill-rate sense and manipulation-adjacent. The consultation may *display* the flag; it never alters the recommended price.
**Display framing (binding):** "This recent update may affect this item" / "An upcoming update may affect this item" — neutral, hedged, link to the wiki article. Never directional ("will rise/fall"), never advisory ("buy before Wednesday"). Geoffery's canonical neutrality line: "I keep accounts, sir. I do not gamble."
**License compliance (binding):** wiki content is CC BY-NC-SA. Annotations are short, factual, original phrasings with a provenance link — never wholesale reproduction. Compliance agent enforces.
**Status:** Locked. MVP-scoped; both directions (historical annotations and upcoming-update flags) ship at MVP.
**Affected agents:** data-engineer (MediaWiki API poller, classification job, annotation storage), algorithms (regime classifier reads "recent update touched this category" as volatility-context input), frontend (chart event markers, item-page notice, in-dialogue acknowledgment), design-character (neutrality copy, neutral-disclaimer pattern, "I keep accounts" line), compliance (CC BY-NC-SA + neutrality enforcement), ops (one new scheduled job; cost monitoring).

## D-014 · Reserved for the supporter billing & accounts system
**Decision:** Reserved slot in the canonical D-NNN sequence for the supporter billing system (Stripe subscriptions, paid-through dates, plan management). The wage-balance, ledger-credit-attribution, and user-profile decisions (D-015, D-007, D-017) all reference D-014 as the billing substrate; its full specification lands when supporter billing enters scope post-MVP. The user-profile in D-017 sketches the schema shape; this slot will pin the Stripe integration shape, retry semantics, refund posture, and proration rule.
**Status:** Reserved (to be specified post-MVP). The MVP tip jar already operates as D-006 specifies (one-time Stripe Payment Links, no subscriptions); no D-014 work happens until accounts ship.

## D-015 · Wage balance display & tip attribution
**Decision (D-015a):** Every logged-in supporter sees their remaining service plainly stated as **"Wages paid through: X months remaining"** (or the dated form, "paid through March 2027") — a homage to the in-game servant's remaining-uses announcement and the tip jar, and the most honest subscription UI possible. Surfaces: account-area header, and available in-dialogue ("How do my wages stand?" → "Sir has provided for the household through three months hence"). Decrement is linear and visible; tips stack onto the paid-through date immediately. **Low-balance behaviour (restraint):** at one month remaining, Geoffery may mention it once, gently. At zero, service reverts to the free tier with a single courteous note — no countdowns, no banners, no loss-aversion. Lapsing back to free is dignified; the free tier is the product, not a punishment.
**Decision (D-015b, binding):** Anonymous tips remain accepted and equally easy; **disclosure happens BEFORE payment, always.** The tip flow must state, plainly and in character, prior to the payment step: (1) tips automatically purchase wage credit at the fixed rate of **$1 = 1 month of supporter service**; (2) credit and ledger standing attach to an account — without login the tip is received as a gift, not as wages or a ledger entry. Logged-out tip flow presents login/signup as the encouraged primary path with "tip anonymously" clearly available as a one-step alternative. Anti-dark-pattern check: anonymous path must remain visible without scrolling, equally styled, free of guilt language. Canonical copy: "A nameless benefactor is appreciated, sir — but I cannot pay wages to a name I do not know. Sign the ledger first, and your gold becomes service."
**No retroactive claiming at MVP.** The disclosure exists precisely so unattributed tips are never a surprise. A claim-by-receipt mechanism may be considered post-MVP if support requests warrant it; not built speculatively.
**MVP carry:** the balance display + attributed credit require accounts (post-MVP per D-010/D-014). At MVP, the tip flow already carries the disclosure in informational form ("when accounts arrive, tips will purchase wage credit at $1 = 1 month; today, all tips are gifts entered in the founding ledger") so the model is consistent from day one. MVP-era tips DO count toward founding-household standing once accounts exist, where identity existed at tip time.
**Status:** Locked. Disclosure copy ships at MVP. Wage balance display + attributed credit ship with accounts post-MVP.
**Affected agents:** frontend (wage-balance component, tip flow with disclosure + dual-path), design-character (balance copy, lapse note, ledger-sign encouragement), monetization (owns disclosure accuracy + anti-dark-pattern check + credit arithmetic), data-engineer (tip records carry attribution state from day one so founding-era attribution is possible later).

## D-016 · Advertising plan
**Decision (D-016a, MVP Phase 1):** Network is **Google AdSense**. **Auto Ads disabled permanently** — manual ad units in fixed reserved containers only. Auto-injected formats (vignettes, anchors, interstitials, side rails) are prohibited; placement decisions belong to this spec, never to a network's optimizer. Ads run from day one even at trivial revenue: the site is visibly ad-supported at birth so ads are never introduced later as a surprise.
**Decision (D-016b, binding placement policy, "three slots total, ever"):** Item pages (desktop): one horizontal unit BELOW the verdict/gauge block (user always receives their answer before encountering any ad) and one unit at page bottom. Mobile: ONE in-content unit only. **Absolute ad-free zones:** the consultation dialogue and any surface Geoffery speaks in; the Exchange Ledger (Patrons); tip and payment flows; methodology and how-we-make-money may carry zero or one bottom unit at most. **Absolute prohibited formats:** sticky/anchored units, floating or expanding units, autoplay or any video ads, interstitials, popups/vignettes, ads that push content on load. **Supporters (wages paid): ad slots are simply not rendered.**
**Decision (D-016c, binding):** Every ad slot is a fixed-dimension reserved container — the space exists in the layout whether or not an ad fills it. **Cumulative Layout Shift from advertising must be zero.** The page never jumps under the user's thumb. Protects the Core Web Vitals D-005 depends on.
**Decision (D-016d, compliance-critical, binding):** In AdSense sensitive-category controls: **real-money gaming services (gold sellers, account shops, boosting/RWT services) — BLOCKED, non-negotiable** (Charter constraint 3; a single gold-seller ad would damage the anti-extraction brand disproportionately). Gambling, betting, get-rich-quick / dubious financial offers — blocked. Compliance reviews quarterly; any observed gold-seller ad is treated as an incident.
**Decision (D-016e):** EU/UK consent via Google's certified CMP, quietest legal presentation. No additional banners beyond what the law requires.
**Decision (D-016f):** Phase 2 (premium network) triggers at sustained ~50k sessions/month — candidates: Mediavine / Raptive / Venatus. **Non-negotiable onboarding terms:** D-016b placement + D-016d category blocks apply unchanged. If a network can't or won't run within this policy, **remain on AdSense.**
**Decision (D-016g):** how-we-make-money page states the ad policy publicly in Geoffery's voice — slot count, prohibited formats, blocked categories. Public policy binds future changes.
**Status:** Locked. AdSense slots + supporter-suppression + public policy text ship at MVP; actual AdSense onboarding waits until traffic warrants the account approval.
**Affected agents:** monetization (network setup, unit config, phase-2 evaluation; enforces Auto-Ads-disabled), frontend (reserved-container implementation, zero-CLS verification, supporter slot suppression, mobile single-unit rule), compliance (category blocks, quarterly spot-checks, gold-seller incident protocol, CMP/privacy-policy accuracy), ops (CMP one-time setup; no ad infrastructure beyond the network's standard tags).

## D-017 · The user profile (lightweight, post-MVP)
**Governing principle:** the profile exists only to make already-locked features work (wage credit D-014/D-015, ledger standing D-007, personal services D-006/D-011) and contains nothing else. Every field traces to a locked decision; speculative fields are not created. The smallest account system that can honour the wage system.
**Decision (D-017a, identity):** Passwordless only — email magic links plus optional Google/Discord OAuth. No passwords anywhere → no resets, no strength rules, no breach surface. Display name is the ONE user-generated content surface: max **12 characters** (in-game name limit; the constraint is itself an homage), RuneScape-style character set, profanity-filtered, unique. Appears in exactly ONE public place: the holder's row in the Exchange Ledger. The total moderation surface of the product is this one string.
**Decision (D-017b, wage state):** Paid-through date, credit/tip history, Stripe customer reference. **No payment data is ever stored locally.** Stripe holds it. Wage-balance display reads from here.
**Decision (D-017c, ledger state):** Cumulative lifetime score, current metal tier, founding-household flag, active-supporter seal, plus ONE privacy switch: **"List me in the public ledger" (ON by default, opt-out).** Opt-out keeps score + tier private; supporter still benefits from generosity at zero cost.
**Decision (D-017d, form of address):** Profile setting for honorific — **sir / madam / custom honorific.** Custom is safe UGC because spoken only to its owner, privately, in dialogue — never renders publicly. No filter beyond length limits.
**Decision (D-017e, feature preferences):** Watchlist contents, alert settings, default consultation urgency — each field created only when its feature ships, never before.
**Decision (D-017f, dashboard):** Private profile page is these facts arranged in Geoffery's voice: wages paid through; tier standing + progress to next metal ("a few platinum shy of mithril, sir"); service statistics ("I have fetched 1,284 prices for you this season"). Shares one source with the wage-ask proportional copy.
**Decision (D-017g, absence list, binding policy not omission):** No avatars or image uploads (tier metal is the visual identity); no bios or free-text fields beyond display name and private honorific; no public profile pages (ledger row IS the public presence); no RSN/game-account linking; no social graph, DMs, followers, activity feeds, comments. Each absence is a moderation surface and maintenance obligation deliberately never built (Charter constraint 1). Proposals to add any of these must overcome this decision on record.
**Decision (D-017h, privacy & deletion):** Total PII: one email + one 12-char display name. Payment data lives at Stripe. Self-serve deletion anonymizes the ledger entry (score remains in tier mathematics, attributed to no one). Data export trivial by construction.
**Status:** Locked (post-MVP; ships with the accounts/billing milestone per D-010/D-014). Schema design may precede implementation (data-engineer), informed by the attribution-state groundwork in D-015.
**Affected agents:** frontend (auth flow magic-link + OAuth, settings, dashboard, ledger opt-out control), design-character (dashboard copy, honorific parameterization, balance/standing dialogue), data-engineer (account schema ~four tables: identity / wage ledger / preferences / sessions; display-name constraints + filter; deletion routine), monetization (Stripe customer linkage; credit attribution at login per D-015), compliance (privacy policy, deletion compliance, profanity filter adequacy).

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

## D-019 · Chrome URL naming convention (was D-014)
**Decision:** Static-page URLs match their nav label, lower-cased, one word where possible: `/ledger`, `/methodology`, `/wages`, `/about`. No prepositions, no full-sentence URLs. Per D-004 every non-canonical URL 301s to the canonical one; this rule applies to chrome pages as well as items.
**Rationale:** Consistency between nav text and URL is a small UX moat — users predict the URL from the label and vice versa. Also reduces the surface area of brand language (single nouns are easier to share, link to, and remember than verb-phrase URLs like `/how-we-rate`).
**Status:** Locked.
**Affected agents:** frontend, growth-seo.
**Migration:** Old URLs (`/how-we-rate`, `/how-we-make-money`) 301 to new (`/methodology`, `/wages`) at three layers: Astro `redirects` config (HTTP 301 at the server), Cloudflare Pages `_redirects` file (true 301 at the edge in prod), and an HTML meta-refresh fallback. Service worker shell paths bumped to v2 to invalidate stale caches.

## D-018 · Repo layout (was D-013)
**Decision:** Source-of-truth files live where their primary readers live. Agent material (`.claude/CHARTER.md`, `.claude/DECISIONS.md`, agent prompts, dispatch rules, proposals) is under `.claude/`. User-facing docs (`design-spec.md`, `deployments.md`) under `docs/`. Repo root carries only what humans skim regularly: `README.md`, `CHANGELOG.md`, `.gitignore`. Code in `pipeline/` and `web/`; env templates in `env/`; operator notes in `local/` (gitignored).
**Rationale:** Discoverability — agents find load-bearing rules next to their own prompts; humans find context next to the README.
**Status:** Locked (trivially reversible).
