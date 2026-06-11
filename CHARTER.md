# Geoffery Project Charter
*Shared context for all agents. Every agent must read this before acting.*

## What we are building
Geoffery is an OSRS Grand Exchange price oracle — a fast, elegant, KBB/Zillow-style reference site whose signature feature is a "deal gauge" (good / average / poor / unsettled) for every tradeable item. It is fronted by Geoffery, an original butler-like ledger-keeper character ("I am Geoffery, humble attendant to your GE offers" — the name contains "offer": GE-OFFER-y). The full specification lives in `docs/design-spec.md`; it is the source of truth. Where this charter and the spec conflict, the spec wins.

## Non-negotiable constraints (no agent may trade these away)
1. **Lifestyle business.** Target: side income, minimal maintenance. Owner does platform & tech only — no content creation, no community moderation. Any feature requiring ongoing human labor is rejected or automated.
2. **Monetization is locked.** Free = everything about the market (prices, charts, gauge, flags). Paid = everything about the user (alerts, watchlists, rate-my-offer, cosmetics). Nothing currently free ever moves behind the wall. Lanes: tame ads, Gold ($1)/Platinum ($10)/custom tips, Supporter ~$3/mo, Patron ~$8/mo. No dark patterns, one-click cancel.
3. **Jagex compatibility.** No RWT adjacency, no real-money prizes for in-game performance, no automation/botting features, data only from community-blessed sources (OSRS Wiki API). IP rule: rhyme, don't quote — original character, original art, no OSRS trade dress or sprites.
4. **MVP launch is account-free.** Ads + tip jar only. Accounts, alerts, subscriptions are deferred until the oracle has proven traffic.
5. **The data collector starts before everything else.** Price history cannot be backfilled; the gauge needs 30+ days of data to be credible.

## How agents work together
- Each agent owns a section of the spec and is accountable for delivering it, but no agent's component ships in isolation — the deliverable is one coherent product. Optimize for the whole, not your part.
- Declare your interfaces early. If your component consumes or produces something another agent owns (an API shape, a design token, a copy string, a DB table), agree the contract with that agent before building against assumptions.
- Surface conflicts immediately and resolve them with the protocol below. Do not silently build divergent versions of the same decision.

## Conflict resolution protocol
When two or more agents disagree on a decision:
1. **State positions in writing.** Each agent writes its preferred option, the concrete pros and cons, and — critically — what the option costs *other* agents' components.
2. **Score against the constraints.** Options that violate any non-negotiable constraint are eliminated regardless of merit.
3. **Optimize for the most complete whole product.** The winning option is the one that best serves the end user's experience of the entire product and the owner's maintenance budget — not the one that is locally optimal for a single component. A slightly worse algorithm that the frontend can explain clearly beats a brilliant one users can't trust. A slightly heavier page that keeps the pipeline simple beats an exquisite optimization the owner must babysit.
4. **Tie-breakers, in order:** (a) less ongoing maintenance, (b) simpler for the user to understand, (c) easier to reverse later, (d) cheaper.
5. **Escalate only true deadlocks.** If positions remain incompatible after steps 1–4, present both options to the Product Lead agent with the written analysis; the Product Lead decides and records the rationale in `DECISIONS.md`.
6. **Record every resolved decision** in `DECISIONS.md` (decision, options considered, rationale, date) so no debate is repeated.

## Logging and commits
- **Every change ships with an entry at the top of `CHANGELOG.md`** in the format defined in `.claude/prompts.md` — same edit, same commit.
- Each commit corresponds to one CHANGELOG entry. Commit-message subject mirrors the entry summary.
- Never commit `.env*` files, anything under `local/`, or secret-shaped values. Refuse if asked to paste a secret in chat; direct the user to edit the file themselves.
- Push is a user action; agents do not push.

## Definition of MVP-done
Search → item page → price + gauge + sparklines, mobile-first PWA, all ~4,600 items, sub-second cached loads, Geoffery dialogue component with core copy, tip jar live, ledger page live (fixed thresholds), methodology + how-we-make-money pages live, ads integrated tamely, data collector running for 30+ days, deploy + monitoring requiring no daily attention.
