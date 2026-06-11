# Proposals

Drafts for CROSS-MODULE changes — anything that requires coordinated edits by more than one agent, or that touches a shared contract (DB schema, aggregate row shape, item-page URL pattern, design tokens). Borrowed lightly from the dexter-dev protocol; for a one-owner MVP, treat the formality as scaffolding rather than enforced ceremony.

## When to file

- A new column on `prices_5m` or `aggregates`. (data-engineer + algorithms + frontend)
- A URL pattern change. (frontend + growth-seo)
- A new Geoffery dialogue state. (design-character + frontend + algorithms)
- Anything Compliance flags before art/branding is commissioned.

LOCAL changes (single agent, internal detail) skip this and go straight to the relevant code + a one-line `DECISIONS.md` entry only if the choice is interesting.

## Format

```
# NNN — <slug>
Initiator: <agent>
Affected agents: <list>
Reversibility: one-way | reversible

## Motivation
why this is needed

## Proposed change
concrete diff or spec

## Per-agent commitments
- <agent>: what they do
- <agent>: what they do

## Rollback
how to undo if it goes sideways
```

Once every affected agent has signed off (`## RATIFY — <agent> — <date>` appended to the file), move to `accepted/` and add an entry to `DECISIONS.md`.
