# Changelog

Newest entry on top. One entry per commit; format in `.claude/prompts.md`. The phased build
history (Phases 0–7) is in the git log and the gate record in `DECISIONS.md`; this file carries
the discipline going forward.

## 2026-06-12 — product-lead — SCOPE: LOCAL
**Summary**: Installed the `.claude/` fleet — nine agents + eight smiths (BUILD-SPEC §2), the
chrome-devtools MCP browser-debug capability (`.mcp.json` + `settings.json`), `SYSTEM_ARCHITECTURE.md`
(as-built), and the governance scaffolding (CHARTER, prompts, proposals). Replicates the dexter-dev
live-browser and architecture-doc patterns. No production source touched.
**Files touched**: `.mcp.json`, `.claude/{settings.json,CHARTER.md,prompts.md,proposals/README.md}`,
`.claude/agents/*.md` (17), `SYSTEM_ARCHITECTURE.md`, `CHANGELOG.md`, `.gitignore`.
**SYSTEM_ARCHITECTURE.md sections affected**: new document.
**Verification**: 17 agent files parse with valid frontmatter; `.mcp.json` valid JSON; `npm run
check` green (no source touched). Live browser debugging of the page issues follows on the next
session, once a Claude Code restart loads the `mcp__chrome-devtools__*` tools.
