# Proposals — cross-module changes

A CROSS-MODULE change (one that spans modules owned by different agents) is not applied until every
affected agent ratifies. LOCAL and CONTRACT changes skip this — they go straight to code +
`docs/CHANGELOG.md` (CONTRACT also edits `SYSTEM_ARCHITECTURE.md` §3 and notifies dependents).

## When to file
- A new D1 column other modules read (`prices_5m`, `aggregates`).
- A change to the generated-JSON export shape, the `ArchiveStore`/`SqlStore` seam, or `/api/consult`.
- A new dialogue state or a change to the recommendation contract.
- Any outward-facing asset needing `design/compliance` review before it ships.

## Format — `.claude/proposals/NNN-slug.md`
```
# NNN — <slug>
- **Initiator**: <agent>
- **Affected agents**: <list>
- **Reversibility**: one-way door | reversible
- **Motivation**: why this change, in two sentences.
- **Proposed change**: the concrete diff to contracts (which §3 seams, which schemas, which copy).
- **Per-agent commitments**: what each affected agent must do.
- **Rollback**: how to undo it.
```

## Ratification
Each affected agent appends one response to the file: `## RATIFY — <agent> — <date>`,
`## AMEND — …`, or `## REJECT — …` (with reasoning). Once every non-initiating affected agent has
ratified, the initiator applies the diff, runs `npm run check`, adds a `docs/CHANGELOG.md` entry, moves
the file to `accepted/`, and records any one-way-door decision in the commit message.
