# Parity checklist — feature-complete vs reference

Each user-observable behavior of the reference, cross-referenced to the spec section that
requires it. Status tracked as the build progresses. "Deliberately dropped" lists reference
behaviors this spec does not require.

## Reference layer (spec §4)
- [x] Item page: current insta-buy + insta-sell (§4)
- [x] Freshness timestamp "updated N seconds ago" — must be true (§4)
- [x] Hourly/24h volume (§4)
- [x] Deal gauge: good/average/poor + unsettled, horizontal band + "you are here" marker (§4)
- [x] Market regime 2×2 label (§4)
- [x] Sparklines 24h / 1w / 1m (§4)
- [x] Descriptive-not-directional tone everywhere on this layer (§4)
- [x] Instant forgiving search (§4)
- [x] Mobile-first installable PWA, dark mode (§4)
- [x] Static pages: methodology (+published accuracy), how-we-make-money, support, ledger, FAQ (§4)
- [x] SEO: `/item/<slug>` URLs, title pattern, sitemap, structured data (§4)

## Consultation layer (spec §5)
- [x] Butler's Bell on every page; item-implicit vs homepage search-in-panel entry (§5)
- [x] Distinct buy / sell dialogue trees with three tolerance classes (§5)
- [x] Recommendation node: price + confidence statement + regime coloring (§5)
- [x] Consultation ends on the item page above the gauge (§5)
- [x] Soft meter 3–5/day, in-character limit message (§5)
- [x] Fill-probability offer engine; 4-sig-fig directional rounding (§5)
- [x] Falsifiable prediction logged per consultation; scorer evaluates against 5m data (§5)
- [x] Weekly calibration; backtest cold-start track record (§5)

## News/context layer (spec §6)
- [x] MediaWiki update polling + diff (§6)
- [x] Closed-vocabulary Haiku classification w/ quoted justification + confidence (§6)
- [x] Neutral hedged display; chart markers, regime context, item notice, in-consult ack (§6)
- [x] Firewall: update flags never alter recommended prices (§6)

## Monetization + ledger (spec §7, §8)
- [x] Tip jar (MVP informational disclosure; attribution state recorded) (§7)
- [x] Exchange Ledger page: bronze→dragon tiers, amounts hidden, founding notation (§8)
- [x] Ad containers: dormant fixed-dimension reserved slots, three slots max, Auto Ads off (§7)
- [x] Category blocks documented (§7)

## Data (spec §0, §3)
- [x] Raw price history exported to R2 daily-file format (Phase 0 — DONE, GATE 0 PASS)
- [x] Live collector: latest/5m/mapping with descriptive user-agent (§3)
- [x] Aggregator: 30/90-day distributions, baselines, regime snapshots (§3)

## Deliberately dropped (reference behaviors this spec does not require for localhost)
- RSS news_events legacy keyword matcher — superseded by the §6 wiki/Haiku pipeline.
- qa/prod Cloudflare Access gating, multi-env env files — prod-only concern, out of localhost scope.
- Live Stripe links, AdSense fill, Search Console — genuinely impossible locally (see DECISIONS D-LOCAL-004).
