# Changelog

Newest entry on top. One entry per commit; format in `.claude/prompts.md`. The full per-commit
history is in `git log`; this file carries the human-readable summaries going forward.

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
