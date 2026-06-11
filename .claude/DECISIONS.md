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
**Decision:** MVP = item pages (search, prices, sparklines, deal gauge with unsettled state), mobile-first PWA, Geoffery dialogue component + ~25 core copy lines, tip jar, ledger page (fixed thresholds), methodology + money pages, tame ads, monitoring. Explicitly deferred: accounts, alerts, watchlists, Supporter/Patron billing, share cards, sentiment features, native app, percentile ledger, Discord anything.
**Status:** Locked.

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
