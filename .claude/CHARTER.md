# Geoffery Project Charter
*Shared context for all agents. Every agent reads this before acting.*

## What we are building
Geoffery is a price oracle and decision assistant for Old School RuneScape's Grand Exchange — a
fast, elegant, mobile-first reference site with a "deal gauge" for every tradeable item, fronted
by Geoffery, an original elderly-dwarf ledger-keeper. Its differentiator is **the Butler's Bell**:
a consultation that turns a user's intent (buy/sell + time tolerance) into a recommended price,
logs each recommendation as a falsifiable prediction, and scores it against the market. The
published fill rate is the trust asset. The full specification is `BUILD-SPEC.md` — it is the
source of truth. Where this charter and the spec conflict, the spec wins.

## Non-negotiable constraints (no agent may trade these away)
1. **Architecture invariants** (`SYSTEM_ARCHITECTURE.md` §4). Core purity (zero I/O in
   `packages/core`); thin workers; the site reads only build-time local data; `packages/content`
   is the sole source of Geoffery's words; two-layer storage with the R2 archive as source of truth.
2. **The §6 firewall.** Game-update flags — especially upcoming ones — never alter a recommended
   price. News reaches a recommendation only indirectly, via the regime volatility classifier
   reading actual market data. Canonical line: "I keep accounts. I do not gamble — you have seen my wages."
3. **Monetization conduct is locked** (spec §7). Free = everything about the market, forever;
   nothing currently free ever moves behind a paywall. Paid = everything about *you*. No dark
   patterns, one-click cancel. Ads: AdSense manual units only, Auto Ads off, three slots, category
   blocks (gold sellers/RWT, gambling, get-rich-quick) non-negotiable.
4. **Jagex compatibility / IP.** Data only from community-blessed sources (OSRS Wiki API +
   MediaWiki); never scrape Jagex properties; wiki content is a signal, never republished.
   "Rhyme, don't quote" — original character, original art, no actual Jagex assets (sprites,
   game-font files, extracted textures). Owner carve-out (D-DESIGN-002, 2026-06-12): the Geoffery
   dialogue box is a **top-level design directive** to be *similar* to the OSRS chatbox — left
   portrait, similar font and colors — executed house-drawn with a freely-licensed look-alike font.
5. **Action-first verdicts** (reversed 2026-06-12, DECISIONS.md D-TONE-001). Gauge verdicts and
   band labels name the move — buy / hold / sell / wait. The methodology page stays qualitative
   (no published formulas, windows, or thresholds); the fill record remains published.

## Runtime reality (localhost)
Production targets Cloudflare; this build runs on localhost via a Node-portable runtime — workers
as Node entries + a Hono consult server, `node:sqlite` as the D1 stand-in, local gzipped daily
files as the R2 stand-in. The documented deviations live in `DECISIONS.md` (D-LOCAL-001..005).
Genuinely-impossible-locally surfaces (live Stripe, AdSense fill, Search Console, DNS cutover) are
stubbed and documented — never faked.

## The fleet (consolidated 2026-06-12 — DECISIONS.md D-FLEET-001)
Four agents in `.claude/agents/`; subagents live in a folder named after their parent.
- **design** (`design/geoffery`, `design/compliance`) — visual elements of the webpage and the
  Geoffery character: `packages/content` (sole source of voice), tokens, assets, the visual eye.
  `design/geoffery` is the final authority on artistic direction and prevails over `design`
  where they disagree; `design/compliance` is the read-only legal/IP guardrail with a veto
  (taste yields to law).
- **web-app** (`web-app/page-smith`, `web-app/dialogue-smith`, `web-app/growth-seo`,
  `web-app/monetization`) — the site, the Bell, the consult surface, PWA, SEO one-way doors,
  tips/ads/ledger surfaces. Owns the browser loop.
- **db** (`db/collector-smith`, `db/schema-smith`, `db/infra-smith`, `db/watch-smith`) — the
  data pipeline, storage seam, news worker, export, schedulers, deploys, monitoring, backups,
  RUNBOOK, costs.
- **core** (`core/engine-smith`, `core/backtest-smith`) — the pure math: gauge, regime, offers,
  scoring, calibration, ledger tiers, methodology accuracy claims.

Orchestration (formerly `product-lead`) belongs to the main session: it sequences the agents,
holds the phase gates, resolves escalated deadlocks, owns `DECISIONS.md` (append; never rewrite
history) and the phase sequencing in `BUILD-SPEC.md` §11. It pulls `design/compliance` and `db`
into any phase with an outward-facing asset or a data-source/infra choice, and `design/geoffery`
into any phase touching artistic direction. Architecture invariants (`SYSTEM_ARCHITECTURE.md` §4)
are re-verified at every gate. When the spec is ambiguous, consult the reference repo
(`~/code/geoffery-dev/geoffery_old`, read-only), then decide and record — never guess silently.

## How agents work together
- Each agent owns a module/area but no component ships in isolation — optimize for the whole product.
- Declare interfaces early. If you consume or produce something another agent owns (a `SqlStore`
  shape, the export JSON, a design token, a copy string), agree the contract before building against it.
- Surface conflicts immediately; resolve with the protocol below. Never silently build divergent versions.

## Conflict-resolution protocol
1. **State positions in writing** — preferred option, concrete pros/cons, and what it costs *other* agents.
2. **Score against the constraints** — any option violating a non-negotiable is eliminated.
3. **Optimize for the most complete whole product** — best for the end-user's experience and the
   owner's maintenance budget, not local optimum. A clear gauge the frontend can explain beats a
   brilliant one users can't trust.
4. **Tie-breakers, in order:** (a) less ongoing maintenance, (b) simpler for the user, (c) easier to reverse, (d) cheaper.
5. **Escalate only true deadlocks** to the orchestrating session, which decides and records the rationale in `DECISIONS.md`.
6. **Record every resolved decision** in `DECISIONS.md` so no debate repeats.

## Change classification (before you touch anything)
- **LOCAL** — inside one module → make the change; note it in `docs/CHANGELOG.md`.
- **CONTRACT** — a public seam in `SYSTEM_ARCHITECTURE.md` §3 → edit your section of the doc; note
  it in `docs/CHANGELOG.md`; notify dependents.
- **CROSS-MODULE** — spans modules → file a numbered proposal in `.claude/proposals/` and stop until
  every affected agent ratifies.

## Repo layout (binding — `db` owns hygiene)
The top level stays legible; new files land in their home, not at root. The root holds
**only**: the spec/governance docs read every session (`README.md`, `BUILD-SPEC.md`,
`SYSTEM_ARCHITECTURE.md`, `DECISIONS.md`, `WHO-FIXES-WHAT.md`), the build configs tooling
resolves from root (`package.json`, `package-lock.json`, `tsconfig.json`,
`vitest.config.ts`, `eslint.config.js`), and the dotfiles discovered only at root
(`.gitignore`, `.mcp.json`, `.nvmrc`, `.env*`). Everything else has a home:
- `docs/` — all other project documentation (`docs/CHANGELOG.md`, `docs/RUNBOOK.md`,
  `docs/AD-POLICY.md`, `docs/SALVAGE.md`, `docs/OSRS-WIKI-STYLE.md`, …). **New prose docs go here.**
- `config/` — relocatable build config not bound to root discovery (`tsconfig.base.json`, …).
- `.claude/` is the agent fleet; `packages/ workers/ site/ tools/ ops/` are code.

Adding a top-level entry is a deliberate act: justify it, or file it under `docs/` or
`config/`. `npm run check` runs `check:layout` (`tools/check-repo-layout.mjs`), an
allowlist guard that fails on any unexpected root entry; the index is `docs/README.md`.
`db` owns this (see `WHO-FIXES-WHAT.md`).

## Compliance veto
`design/compliance` holds a veto on any violation of constraints 2–4 above (IP, data source, ad
category, RWT adjacency, the firewall). The default on a flagged violation is **block** until resolved.

## Logging, commits, secrets
- Every change ships with a `docs/CHANGELOG.md` entry (format in `.claude/prompts.md`); one entry per commit.
- Never commit `.env*`, anything under `local/`, or secret-shaped values. If asked to paste a secret
  in chat, refuse and direct the user to edit the file themselves.
- Commit/push only when the user asks. Never `--force`, never `--no-verify`.
