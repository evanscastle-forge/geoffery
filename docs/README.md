# Documentation index

A map of Geoffery's prose docs. The top level stays lean: the **root** holds only the
governance docs every agent reads, and everything else lives here in `docs/`.
The layout is enforced by `tools/check-repo-layout.mjs` (`npm run check`) and owned by
the `db` agent — see `.claude/CHARTER.md` → "Repo layout".

## At the repo root (governance — read every session)
| Doc | What it is |
| --- | --- |
| `../README.md` | Project overview + localhost quick-start. |
| `../SYSTEM_ARCHITECTURE.md` | As-built module map, public seams (§3), invariants (§4), routing (§5). |
| `../.claude/CHARTER.md` | Binding constraints, the agent fleet, and the coordination protocol. |

> The owner also keeps a detailed product spec and a decision ledger privately under `local/`
> (gitignored) — those are **not** part of this repo.

## In `docs/` (project documentation)
| Doc | What it is |
| --- | --- |
| `CHANGELOG.md` | Per-commit change log (newest on top); format in `.claude/prompts.md`. |
| `RUNBOOK.md` | Operational procedures: bring-up, job cadences, alerts, rollback, restore drill. |
| `AD-POLICY.md` | Advertising placement + category-block policy (spec §7); dormant on localhost. |
| `SALVAGE.md` | Provenance log for every constant/insight carried from the reference repo. |
| `OSRS-WIKI-STYLE.md` | Measured design reference from the live OSRS Wiki (palette, type, layout). |

## Where new things go
- **New prose doc** → `docs/`.
- **Relocatable build config** (not bound to root discovery) → `config/`.
- **A new file at the repo root** is a deliberate act — justify it, or it belongs in
  `docs/` / `config/`. `npm run check` will fail otherwise.
