# Advertising policy (spec §7) — compliance-critical, permanent

The ad surface on localhost is **dormant**: reserved fixed-dimension containers render
but load no ad script and no Auto Ads (DECISIONS D-LOCAL-004). This document is the
policy those containers will enforce in production, and the compliance checklist.

**Status (2026-06-15):** the integration is **wired and env-gated**. `AdSlot.astro` renders a
real manual unit and `Base.astro` injects the loader only when `PUBLIC_ADSENSE_CLIENT` + the
per-kind `PUBLIC_ADSENSE_SLOT_*` ids are set; dev/localhost have no publisher id → dormant.
Activation is prod-only: set the env vars after AdSense approves the site, keep Auto Ads off,
and have `design/compliance` confirm the category blocks before flipping it on (see
`docs/CLOUDFLARE-SETUP.md` §5b).

## Placement — "three slots, total, ever"
- Item pages, desktop: one horizontal unit **below** the verdict/gauge block + one at page bottom.
- Item pages, mobile: ONE in-content unit. The price check never requires scrolling past an ad.
- Implemented as `AdSlot` (`kind`: `item-mid`, `item-bottom`, `mobile`) — fixed dimensions,
  present whether filled or not (zero CLS by construction).

## Ad-free zones (never render a slot)
- The consultation dialogue (the Butler's Bell).
- The Exchange Ledger.
- Tip / payment flows (the money page).

## Prohibited formats (never)
Sticky/anchored, floating, expanding, autoplay, video, interstitials, vignettes.

## Category blocks (non-negotiable; quarterly spot-checks)
- **Real-money gaming services** — gold sellers, account shops, boosting: BLOCKED. One
  gold-seller ad is treated as an incident.
- **Gambling** and **get-rich-quick**: BLOCKED.

## Network
- Phase 1: Google AdSense, **Auto Ads disabled permanently**, manual units only.
- Consent: Google's certified CMP, configured once, quietest legal presentation.
- Phase 2 (≥~50k sessions/mo): Mediavine/Raptive/Venatus candidates — onboarded only if
  this placement policy and these category blocks apply unchanged; otherwise stay on AdSense.

## Supporters
Ad slots are simply not rendered for supporters.
