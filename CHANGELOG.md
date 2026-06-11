# Geoffery System Changelog

Newest entries at the top. Every change ships with one entry — see `.claude/prompts.md` "CHANGELOG discipline" for the format and rules. Each entry corresponds to one git commit.

---

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
