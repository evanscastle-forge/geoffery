# Dispatch & working rules

## What this repo is
Geoffery — an OSRS Grand Exchange price oracle + the Butler's Bell consultation. Source of truth:
`BUILD-SPEC.md`. Shared context: `.claude/CHARTER.md`. System map: `SYSTEM_ARCHITECTURE.md`.
Symptom→owner routing: `WHO-FIXES-WHAT.md`. Phase gates + decisions: `DECISIONS.md`.

## Agent roster (read the agent file before acting as one)
Four agents in `.claude/agents/` (consolidated 2026-06-12, DECISIONS.md D-FLEET-001); subagents
live in a folder named after their parent:
- `design` (+ `design/geoffery`, `design/compliance`) — webpage visual elements + the Geoffery
  character; packages/content (sole source of voice) + the visual eye. The OSRS Wiki is the
  explicit aesthetic reference (D-DESIGN-001) — design may peruse the live wiki at will.
  `design/geoffery` is the final taste authority (prevails over `design`); `design/compliance`
  is the read-only IP/data-source/ad-category reviewer with a veto.
- `web-app` (+ `web-app/page-smith`, `web-app/dialogue-smith`, `web-app/growth-seo`,
  `web-app/monetization`) — site, the Bell, consult surface, PWA, ad containers, URLs/titles/
  sitemap/structured data, tips/ads/ledger economics. **Owns the browser loop.**
- `db` (+ `db/collector-smith`, `db/schema-smith`, `db/infra-smith`, `db/watch-smith`) —
  packages/data, collector, news, export, storage, ops/, deploys, monitoring, backups, costs.
- `core` (+ `core/engine-smith`, `core/backtest-smith`) — packages/core, aggregator, scorer,
  backtest, methodology math.
Orchestration (sequencing, gates, deadlocks, DECISIONS.md — formerly `product-lead`) belongs to
the main session per `.claude/CHARTER.md`.

## Routing rules
1. Read `.claude/CHARTER.md` and the relevant agent file once per session.
2. Match the request to the owning area in `WHO-FIXES-WHAT.md`; act as (or dispatch to) that agent.
3. If ambiguous, ask — don't guess across an ownership line.
4. Pull `design/compliance` and `db` into any phase with an outward-facing asset or a data-source/infra choice.

## The live browser loop (chrome-devtools MCP)
`.mcp.json` registers the `chrome-devtools` MCP server; its tools (`mcp__chrome-devtools__*`) load
on a Claude Code **restart** (the server does not hot-reload). To debug what the browser renders:
1. `npm run dev` (site :4321, consult :8787, `/api` proxied). Confirm with `lsof -nP -iTCP:4321 -sTCP:LISTEN`.
2. `new_page` → `navigate_page` (**`ignoreCache: true`**) → `list_console_messages` →
   `list_network_requests` → `take_screenshot` at 1440×900 and 390×844 (`resize_page`) →
   `evaluate_script` for computed styles.
3. Save artifacts under `local/<task-slug>-YYYY-MM-DD/` (gitignored). Stop the stack with
   `pkill -f astro` + `pkill -f "consult/src/main"`.
The full loop lives in the `web-app`, `web-app/page-smith`, `web-app/dialogue-smith`, and `design` agents.

## CHANGELOG discipline
- Newest entry on top of `docs/CHANGELOG.md`. One entry per commit; the commit subject mirrors the summary.
- Format:
  ```
  ## YYYY-MM-DD — <agent> — SCOPE: LOCAL | CONTRACT | CROSS-MODULE
  **Summary**: one to three sentences.
  **Files touched**: …
  **SYSTEM_ARCHITECTURE.md sections affected**: none | §2.x, §3.x
  **Notify** (CONTRACT/CROSS-MODULE): <dependent agents>
  **Verification**: how it was checked (tests, browser loop, restore drill).
  ```
- Three sentences is plenty for most entries.

## Commit & secrets
- Commit/push only when the user asks. Never `--force`/`--no-verify`. Never commit `.env*`, `local/`, or secrets.
- End commit messages with the Co-Authored-By trailer; never paste a secret into chat.

## Terminology
- Prefer "local" over "dev" for the deployment posture. "Geoffery" is one R, two Fs — the "offer" is the point.
