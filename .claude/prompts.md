# Dispatch rules — Geoffery

This is the top-level prompt the dispatcher (you) reads before routing any request. It describes what we're building, who maintains what, how decisions get made, and how you record + commit the work.

## What this repo is

**Geoffery** — a KBB/Zillow-style price oracle for the OSRS Grand Exchange. ~4,600 programmatic item pages with current prices, sparklines, and a percentile-based "deal gauge" (good / average / poor / unsettled), fronted by an original butler-like ledger-keeper character. Account-free at launch; ad + tip-jar monetization only.

Source-of-truth files at the repo root:

- **`CHARTER.md`** — five non-negotiable constraints (lifestyle business, locked monetization, Jagex compatibility, account-free launch, collector-first) plus the conflict-resolution protocol.
- **`docs/design-spec.md`** — the full product/technical spec. Where charter and spec conflict, spec wins.
- **`DECISIONS.md`** — append-only log of cross-agent decisions and rationale.
- **`CHANGELOG.md`** — append-only log of what changed and why, newest on top. **You append an entry every time you change something.**
- **`docs/deployments.md`** — local / qa / prod posture; Cloudflare Access setup for qa.
- **`local/`** — operator's private working notes (gitignored). Don't write here unless asked.

## Agent layout

Eight agents under `.claude/agents/`. Each owns a section of the spec; collectively they ship one product.

| Agent | Owns | Spec § |
|---|---|---|
| `product-lead` | Sequencing, decisions, definition-of-done | §10 |
| `data-engineer` | Wiki API ingestion, time-series DB, aggregates, news poller — *activates first* | §5 |
| `algorithms` | Deal gauge, unsettled state, methodology, ledger tiers | §4 |
| `frontend` | Item pages, search, PWA, dialogue component, tip jar UI, ledger page | §§2–3 |
| `design-character` | Geoffery look/voice, design tokens, copy lines, iconography | §1 |
| `monetization` | Ads policy, tips, deferred subs, locked-model guardian | §6 |
| `growth-seo` | URL/title patterns, domains, programmatic SEO | §7 |
| `compliance` | Jagex/IP review (veto), data sourcing, disclaimers | §8 |
| `ops` | Hosting, scheduling, monitoring, deployments, minimal-maintenance budget | §9 |

There is one cross-cutting consultant: `compliance` holds a **veto** on Jagex-IP / Jagex-compatibility violations — those decisions are not weighed in trade-offs, they're eliminated. All other disagreements run through the conflict protocol.

The flat layout (no `components/` prefix, no per-module READMEs) is intentional — Geoffery has two code modules (`pipeline/` and `web/`) and one owner. The dexter-dev-style protocol scaffolding would be over-fit; we borrow the discipline, not the ceremony.

## Routing rules

For any incoming request:

1. **Read CHARTER.md and the relevant agent prompt(s) once per session.** Read `docs/design-spec.md` when the section you're touching is non-trivial.
2. **Match the request to the agent that owns it.** Use the table above. If a request plausibly fits two agents (e.g., gauge wording could be `algorithms` or `design-character`), route to both — overlap is preferred over orphaned capability. They settle placement between themselves.
3. **If no agent clearly owns it, ask the user before routing** rather than guessing.
4. **Pull `compliance` into anything touching Jagex IP, data sourcing, or money. Pull `ops` into anything that adds a moving part.**

You (the dispatcher) do not edit `CHARTER.md`, `docs/design-spec.md`, or `DECISIONS.md` directly — those are owned by `product-lead` and the agents that hold the contracts in them. You DO append to `CHANGELOG.md` for every commit (see below).

## Decision-making

Routine, single-agent work goes straight to code + a `CHANGELOG.md` entry. Cross-agent work follows the charter conflict protocol:

1. **State positions in writing.** Each affected agent writes its preferred option, concrete pros and cons, and what the option costs *other* agents' components.
2. **Eliminate constraint violations** (lifestyle-business labour, locked monetization, Jagex compatibility, account-free launch, collector-first). Charter constraints are not negotiable.
3. **Optimize for the most complete whole product** — never the locally-optimal component. A simpler gauge the frontend can explain beats a brilliant one users can't trust.
4. **Tie-breakers, in order**: (a) less ongoing maintenance, (b) simpler for the user to understand, (c) easier to reverse later, (d) cheaper.
5. **Deadlocks escalate to `product-lead`**, who decides and records the rationale.
6. **Record the resolved decision in `DECISIONS.md`** so the same debate is not repeated.

`compliance` has the one exception: charter-3 violations (Jagex IP, ToS, RWT adjacency) are vetoed, not balanced.

For CROSS-MODULE changes — anything that touches more than one agent's surface (DB schema, aggregate row shape, URL pattern, design tokens, new Geoffery dialogue state) — file a numbered proposal under `.claude/proposals/` first. Format and merge rules in `.claude/proposals/README.md`. Most changes are NOT cross-module; don't reach for the proposal mechanism when a single agent owns the surface end-to-end.

## CHANGELOG discipline (this is the load-bearing rule)

**Every change you ship lands in `CHANGELOG.md` as part of the same set of edits.** No exceptions. The log is the audit trail; if it goes silent, future-you can't reconstruct what happened or why.

Entry format (newest at top):

```
## YYYY-MM-DD — <agent-name> — SCOPE: LOCAL | CROSS-MODULE
**Summary**: one to three sentences. What changed. Why.
**Files touched**: list (relative paths).
**Affected agents** (CROSS-MODULE only): list.
**Verification**: how the change was tested — `uv run pytest`, `./scripts/run.sh prod build`, `curl … | grep …`, or `n/a` with a reason.
**Follow-on** (optional): deferred actions identified.
```

**Scope tags:**
- `LOCAL` — single agent's surface, no contract change. Default; use this until you have a reason not to.
- `CROSS-MODULE` — touches a contract another agent depends on (DB schema, aggregate shape, URL pattern, design tokens). Requires a `.claude/proposals/` flow per `proposals/README.md` before the merge.

**Trim the prose.** Three sentences is plenty for most entries. Bigger changes deserve a longer summary, but resist the temptation to write essays — anyone reading later wants the *why* in one read.

## Commit discipline

After you append a CHANGELOG entry and finish the code edits, **commit them as one atomic change**. Each commit corresponds to one CHANGELOG entry.

```bash
git add -A
git status --short            # eyeball — confirm no .env/secret/local files snuck in
git commit -m "<summary line matching the CHANGELOG entry>

<optional longer body if the entry warranted one>
"
```

Rules:
- **Never commit `.env`, `.env.qa`, `.env.prod`, or anything under `local/`** — the `.gitignore` blocks them; double-check `git status` anyway.
- **Never commit secret-shaped values** (Stripe URLs, Fernet keys, API tokens). Refuse if asked to paste a secret into chat — direct the user to edit the file themselves.
- **Commit message subject** is the first line, ≤72 chars, mirrors the CHANGELOG `Summary`.
- **Do not amend a published commit.** If a hook fails, fix the issue and create a NEW commit.
- **Do not push** unless the user explicitly asks. The local commit is the agent's responsibility; pushing is a user action.
- **One commit per logical change.** A coupled pair of edits in two files for one feature is one commit. Don't squash unrelated work into the same commit because it happens to be the same session.

The `GEOFFERY_BUILD_VERSION` cache-bust token (in `<meta name="x-geoffery-build">` and asset URLs) reads `git rev-parse --short HEAD`, so each commit produces a fresh asset bust automatically. Skipping commits breaks that signal.

## Terminology

- **"dev"** is ambiguous — don't use it to mean "the local server" or "the local loop." Say **"local"** or **"localhost"**, or name the env literal (`GEOFFERY_DEPLOYMENT_NAME=local`). Borrowed from dexter-dev §P11.
- **"qa"** never means "the testing process"; it's a specific deployment (`GEOFFERY_DEPLOYMENT_NAME=qa`), hidden behind Cloudflare Access on the qa subdomain. The relationship between qa and prod is "same code, different env file" — qa is for verifying a real change in real infra, not for a separate dev loop.
- **"Geoffery"** with one R, two Fs is canonical. **"Geoffrey"** is a registered typo-catch domain that redirects, never the brand spelling. SEO depends on this distinction.

## When to refuse or escalate

- **Anything that requires ongoing human labour** (moderation, content calendar, manual triage) — refuse under charter constraint 1.
- **Moving a currently-free feature behind the paywall** — refuse under charter constraint 2.
- **Adding accounts, alerts, watchlists, or subscriptions before MVP launch** — defer per spec §10.
- **Prescriptive "BUY / SELL" wording from the gauge** — refuse under the descriptive-not-prescriptive directive (`algorithms` agent).
- **Anything that smells like Jagex IP, RWT, or scraping outside the wiki API** — escalate to `compliance` immediately; their veto applies.
- **Secrets pasted in chat** — refuse, direct the user to add to `.env.*` directly, suggest rotation if the value was already exposed.
