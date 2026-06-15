# 001 — monetization: real tipping (Stripe) + wired ads

- **Initiator**: web-app (monetization)
- **Affected agents**: db (schema + export + ops/Access), design/compliance (copy, PII, ad categories), core (none — no math change)
- **Reversibility**: reversible (feature-flagged by env/secrets; schema add is additive; ads env-gated)
- **Motivation**: The tip jar and ad slots are stubbed; we are making tips actually charge (Stripe
  Checkout, test mode on dev) so a tip lands in a verifiable account, and wiring AdSense so prod
  activation is one config step. The locked model (free-forever, no amounts shown, no recurring
  product, no dark patterns) is unchanged — this implements tips-as-allowed, not a new model.

## Proposed change (concrete)
- **Schema (CONTRACT)**: add a `donations` table (`packages/data/src/schema.ts`) + repo helpers
  (`insertDonation`, `monthlyDonationTotal`, `recentDonors`). Amounts stored for jar math only,
  never shown publicly (spec §8). Re-applied via `ops/run.sh <env> provision-schema`.
- **Consult worker (§2.8 / §3.5)**: add `POST /api/tip` (Stripe Checkout Session for the exact
  amount) and `POST /api/stripe/webhook` (signature-verified → `insertDonation`). New env
  secrets `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Export (§3.3 CONTRACT)**: `ops/scheduler/export.ts` emits `site/src/generated/donations.json`
  (per-month total → jar level + opt-in names); `money.astro` reads it for the live jar/wall.
- **Site**: `money.astro` posts to `/api/tip` and redirects to Stripe; the thank-you/cookie/jar
  fire only on the success return. Ads: `AdSlot.astro` + `Base.astro` render real AdSense units
  when `PUBLIC_ADSENSE_CLIENT` is set (Auto Ads off, 3 slots, ad-free zones unchanged).
- **Content/compliance**: rewrite `money.tippedNote` (gift, not purchase); donor names opt-in only.
- **Ops/Access**: a Cloudflare Access **Bypass** policy on `dev.geoffery.gg/api/stripe/webhook`
  (server-to-server; secured by the Stripe signature).

## Per-agent commitments
- **db**: donations table + helpers; export of `donations.json`; the webhook Access-bypass + docs.
- **web-app (monetization)**: the `/api/tip` flow, money-page wiring, ad env-gating.
- **design/compliance**: ratify the tip-as-gift copy, donor-wall PII stance, ad-category blocks.

## Rollback
- Unset the Stripe secrets (tips fall back to "not configured"); drop the `donations` table (additive);
  remove `PUBLIC_ADSENSE_CLIENT` (ads dormant). Revert the commit.

## RATIFY — orchestrating session (on behalf of the fleet) — 2026-06-15
Approved via the plan-mode review for this session; `design/compliance` review is a required gate
before the copy + ad categories ship to prod.
