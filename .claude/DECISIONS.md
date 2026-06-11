# Decisions Log

Append-only record of cross-agent decisions and their rationale. Newest on top. Per charter §conflict-resolution: every resolved option lands here so debates aren't repeated.

Entry format:

```
## YYYY-MM-DD — <decision title> — <decider>
**Options considered**: brief list.
**Chosen**: which one and why (cite charter constraints / tie-breakers).
**Affected agents**: list.
**Reversibility**: one-way-door | reversible.
**Follow-ons**: optional pending work.
```

---

## 2026-06-11 — Three deployments: local / qa / prod, qa hidden behind Cloudflare Access — ops + product-lead
**Options considered**: (a) prod-only, no qa zone; (b) two zones with qa publicly reachable but noindex'd; (c) mirror the dexter-dev posture with three deployments and qa locked behind Zero Trust.
**Chosen**: (c). Tie-breakers 1 (less ongoing maintenance — "works in qa ⇒ works in prod" eliminates a class of "but it worked locally" bugs at the cost of one extra env file) and 3 (easier to reverse — qa is the place to verify a wiki API change or a gauge tuning without burning prod history). Defence-in-depth on qa hiding: Cloudflare Access (primary, email allowlist), `<meta robots noindex,nofollow>`, robots.txt `Disallow: /`, no `<link rel=canonical>` from qa to prod, no sitemap on qa. Live Stripe tip-jar URLs only render when DEPLOYMENT_NAME=prod, so an accidental real-money flow on qa is structurally impossible.
**Affected agents**: ops, frontend, data-engineer, monetization.
**Reversibility**: reversible — qa can be deleted without prod impact. The env-var shape (`GEOFFERY_DEPLOYMENT_NAME`) is the one one-way door; mirrors the dexter-dev `DEXTER_DEPLOYMENT_NAME` literal so the patterns travel.
**Follow-ons**: owner runs the Cloudflare Access setup (subdomain CNAME + Access app + email allowlist) — see `docs/deployments.md`. Prod tip jar fills only after Stripe Payment Links are created in the dashboard.

## 2026-06-11 — Stack: Python pipeline + Astro static site + SQLite — product-lead
**Options considered**: (a) Python+SQLite+Astro, (b) Full TypeScript (Node + Next.js), (c) defer choice.
**Chosen**: (a). Charter tie-breaker 1 (less maintenance) and 4 (cheaper). SQLite for a single-writer cron-driven pipeline is set-and-forget; Astro static-generates all ~4,600 item pages at build time so request-path is pure CDN. One DB file is trivially backed up — irreplaceable raw history is satisfied. Python ecosystem (`httpx`, `pandas`, plain stdlib) is the boring choice for ETL.
**Affected agents**: data-engineer, frontend, ops.
**Reversibility**: storage choice is reversible while the dataset is small; URL structure and DB schema are the one-way doors that ride on it.
**Follow-ons**: data-engineer + algorithms agree the `aggregates` row shape (the gauge contract) before either builds against it.

## 2026-06-11 — Repo reorganization — product-lead
**Options considered**: leave files at root vs. canonical layout.
**Chosen**: canonical layout (`docs/`, `.claude/agents/`, `pipeline/`, `web/`, `data/`). Agent files placed in `.claude/agents/` so Claude Code loads them automatically.
**Affected agents**: all.
**Reversibility**: trivially reversible.
