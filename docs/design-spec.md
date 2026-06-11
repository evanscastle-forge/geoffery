# Geoffery — Design Specification
*OSRS Grand Exchange price oracle. "I am Geoffery, humble attendant to your GE offers."*

Digest of all decisions from the brainstorming session, sorted by component responsibility.

---

## 1. Brand & Character

**Identity**
- Name: **Geoffery** (deliberate spelling — contains "offer": GE-OFFER-y). Logo stylization may emphasize the pun (GEOFFERy); body text uses "Geoffery."
- Tagline / intro: "I am Geoffery, humble attendant to your GE offers" (also serves as homepage intro and meta description; variant: "I attend to your GE offers, so you needn't attend to them yourself.")
- Standard spelling "Geoffrey" registered as redirect domain to catch typos.
- Positioning: KBB/Zillow-style price oracle for OSRS — entertainment-adjacent utility, not a get-rich flipping terminal. The "source of truth" people check before any significant GE purchase.

**Character design**
- Original creature, ambiguous ancient species (running joke: "I predate the question, master"). Impeccably dressed ledger-keeper: waistcoat, pince-nez, quill, enormous ledger.
- NOT the demon butler, NOT any Jagex character. Archetype homage only — rhyme, don't quote.
- Personality: formally servile, quietly proud of data freshness; dry, weary wit (never wacky); honest to a fault (voices uncertainty and the "how we make money" page); asks for wages rarely, politely, proportionally to value delivered, never twice in a week, bows out gracefully when dismissed.
- Commission: character sheet of poses (idle, bowing, alarmed, moved, holding ledger) + alternate outfits for patron cosmetic skins. One-time cost.
- Copy: ~40–60 static lines covering all UI states (errors, empty states, wage asks, tip reactions, market warnings, tier appraisals). Written once; no ongoing content burden.

**Voice surfaces**
- Dialogue box component: portrait-left, RPG-convention dialogue panel. Original art and panel design — must NOT replicate OSRS chatbox trade dress (texture, borders, fonts).
- Geoffery is the voice of: error pages, empty states, changelog, methodology page, monetization page, ledger page, wage/supporter asks, tip acknowledgments, market-uncertainty warnings.

---

## 2. Website (Frontend)

**Core pages**
- Item pages (~4,600): the product's heart. Above the fold: current instant buy/sell, freshness timestamp, volume, deal gauge verdict. Below: suggested-offer module (paid), trend sparklines (24h / 1w / 1m), full charts, auto context flags.
- Search: instant, forgiving, fast — the habit-forming entry point. Speed is the moat ("Google won search on speed").
- Deal gauge: horizontal band (good / average / poor + "unsettled" state) with "you are here" marker, plain-language verdict badge, link to public methodology.
- Market overview / trending: "most checked items today," index-level views (low priority, post-MVP).
- The Exchange Ledger (public donor wall): tiers in descending order, Geoffery's commentary as section headers, founding-household notation for early supporters, active-supporter seal next to currently-subscribed names. Designed to be screenshotted.
- Static pages: how-we-rate methodology, how-we-make-money, about.

**Engagement features (automated, zero-moderation)**
- Share card generator: clean image of gauge/price per item; patron accounts get fancier frame/seal/Geoffery hat-tip. Every share is branded marketing.
- Optional later: bull/bear sentiment buttons, prediction polls — only if zero moderation burden holds.
- Explicitly excluded: forums, comments, Discord community, anything requiring moderation or content creation.

**UX principles**
- Elegant, fast, uncluttered — the differentiator vs. GE Tracker's dated density and the wiki's clutter. Dark mode native.
- Answers "what do I actually pay right now" above the fold; ends the research loop with a satisfying verdict.
- Tame ads only: no autoplay video, no layout shift. Ad quality is part of brand trust.
- Tip jar icon in page corner (original art, not in-game sprite).

---

## 3. Mobile

- Mobile is the primary surface: the core moment is a 15-second price check mid-game.
- MVP: PWA-style responsive mobile site — installable, instant search, gauge above the fold. Same features as desktop, tailored layout. One codebase, no app-store friction.
- Native app: deferred. Build only if push-notification price alerts (a paid feature) justify the overhead — the one thing a PWA does meaningfully worse.

---

## 4. Algorithms & Data Science

**Deal gauge (v1 — deliberately simple)**
- Current price's percentile within trailing 30-day distribution, volume-weighted.
- Bands: good = below interquartile range; average = within; poor = above. Adjust for volume thinness.
- Fourth state "unsettled": triggered by volume/volatility anomalies or recent game updates — "ratings unreliable right now." Builds trust in the other three states; acts as liability valve.
- Methodology published openly. Framing is always descriptive ("12% above 30-day average"), never prescriptive commands — user supplies judgment (CarMax/Zillow model: rate the market, user makes the call, shared agency).

**Suggested offer (paid feature)**
- Price at which an offer reliably fills, with rough fill-likelihood ("fills ~85% within 1 hr"), derived from recent price/volume data.
- Open question: whether public volume data suffices or opt-in user trade imports (RuneLite-style) become the data flywheel later.

**Context flags (automated)**
- Poll Jagex news/RSS; keyword-match updates to item categories → auto-annotations on charts and item pages ("Game update 2 days ago touched ranged weapons").
- Volume/whale anomaly detection ("volume 3x normal, price may be unstable").
- No ML required anywhere in v1; percentile math + heuristics. Occasional tuning is the main maintenance.

**Ledger tier algorithm**
- One cumulative lifetime score: tips + supporter months + patron months, all lanes feed one ladder.
- Launch: fixed dollar-ish thresholds, exponentially spaced (bronze = any tip; dragon genuinely rare, ~few hundred lifetime).
- At scale (few hundred names): switch to percentile-based tiers (dragon = top ~2%, etc.) so inactive donors passively drift down as others accumulate — no decay rule, no punishment, the ladder grows beneath them. Frame the switch in-voice: "the household has grown; Geoffery has reorganized the ledger."
- Boundaries recalculated monthly, not live. Demotions silent — never announced.
- Within a tier: order alphabetically or by join date, never by amount (amounts stay anonymous).
- Private progression on user dashboard ("you stand among the adamant; the mithril ranks lie just above").

---

## 5. Data Pipeline & Database

- Source: OSRS Wiki real-time prices API (latest, 5-minute, hourly endpoints) + item mapping list. Community-blessed pipeline (same lineage as GE Tracker/RuneLite usage). Respect rate limits and attribution.
- Scheduled ingestion job (cron) → time-series store for ~4,600 items.
- **Start the collector immediately, before anything else** — the gauge needs 30+ days of history to be credible and history cannot be backfilled.
- Jagex news feed poller + keyword→category matcher feeding context flags.
- Derived/cached aggregates: 30/90-day distributions, percentiles, volume baselines per item (recomputed on schedule, not per-request).
- User data (post-MVP): accounts, watchlists, alert subscriptions, ledger scores, tip/sub history.
- Architecture goal: set-and-forget. Heavy caching / static generation for item pages; minimal moving parts; the whole system is "cron jobs + math + cached pages."

---

## 6. Monetization & Billing

**Locked model — committed publicly, never substantially changed**
- Public promise: nothing currently free ever moves behind the wall. New paid features may be added; existing free ones never migrate. This is the anti-AdBlock-arc insurance.
- Principle: **free = everything about the market; paid = everything about *you*** (personal services with real per-user cost).

**Four lanes**
1. **Ads (free tier):** tame display ads on all pages. Carries most revenue; realistic RPM ~$2–8, so traffic volume is the game.
2. **Tip jar:** one-time Stripe payments. Denominations: **Gold ($1)** and **Platinum ($10)** + custom. Original coin/token art evocative of (never copied from) in-game currency; labeled simply "Gold"/"Platinum" — the callback stays unspoken. Geoffery reactions scale with size; tippers get small permanent acknowledgment.
3. **Supporter (~$3/mo or ~$25/yr):** no ads, price alerts (push/email), synced watchlists, "rate my offer" personalized verdict + fill estimate, badge/flair. Pitched as wages: "the site is free; supporters keep Geoffery employed." Annual tier priced attractively to smooth seasonal OSRS traffic.
4. **Patron (~$8/mo):** pure prestige/gratitude — Geoffery in formal livery, greets by name, signs share cards, alternate portrait skins, top acknowledgment. No extra utility.

**Conduct commitments**
- No dark patterns: no auto-converting trials, one-click cancel, public "how we make money" page (in Geoffery's voice).
- Wage asks in-character, rare, proportional, showing the user's own usage stats ("I've fetched 1,284 prices for you this month").
- Free tier requires no account at launch.

---

## 7. SEO & Growth

- Every item page is a programmatic SEO landing page: title pattern "Twisted bow GE price & deal rating — Geoffery." Brand tagline carries "GE offers"; page titles carry "price" (the actual search token).
- Distinctive spelling "Geoffery" = SEO asset: uniquely ownable vs. the common name (Lyft/Tumblr pattern).
- Domains: check **geoffery.gg** (primary candidate; .gg winks at gp), askgeoffery.com/.gg, geoffery.exchange; register the standard spelling **geoffrey** variants + an OSRS-keyword domain as redirects. Register both spellings immediately.
- Organic loops (no content creation): share cards posted to Reddit/Discord arguments; ledger screenshots; gauge verdicts as debate-settlers ("Geoffery says you overpaid"). Existing subreddits (r/OSRSflipping, r/GrandExchangeBets) are the community — Geoffery is the tool they link, not a community to manage.
- Expect 6–12 month SEO ramp; cold start is the make-or-break work.
- Diligence: search existing OSRS tools/trademarks for "Geoffery/Geoffrey" collisions before committing.

---

## 8. Legal & Jagex Compatibility (hard constraints)

- Zero conflict with Jagex: no RWT adjacency, no real-money prizes tied to in-game performance (gambling/RWT optics), no botting/automation features, no ToS-violating scraping. Data only from community-blessed sources (wiki API, RuneLite ecosystem).
- IP discipline — "rhyme, don't quote": original character (no Alathazdrar, no "demon butler" branding), original dialogue-box design (no OSRS chatbox trade dress), original coin/token/metal-tier art (no sprite copying), tier names bronze→dragon are generic words (the sequence is the safe wink).
- Standard footer disclaimer: not affiliated with/endorsed by Jagex.
- Prizes/rewards anywhere in the product: cosmetic/site-side only, never gp or memberships.

---

## 9. Operations & Maintenance (lifestyle-business constraints)

- Ambition ceiling: side income (~$2k/mo class), minimal maintenance, no scaling pressure.
- Owner role: platform & tech only. No content creation, no community moderation, no editorial calendar. All engagement features must be automated or user-generated-with-zero-moderation.
- Ongoing labor budget: occasional gauge tuning, news-keyword tuning, dependency upkeep, ad/billing admin. Everything else is cron jobs.
- Discord: skipped at launch entirely (bot without community = dead weight; community = unwanted part-time job). Revisit only if it can be purely an acquisition channel.

---

## 10. MVP Build Order

1. **This week regardless:** register domains (both spellings); start the data collector (history can't be backfilled).
2. Data pipeline: wiki API ingestion → time-series store + derived aggregates.
3. Item pages: search, prices, sparklines, deal gauge — static/cached, SEO-ready, mobile-first PWA.
4. Gauge math v1 (percentile + unsettled state) with public methodology page.
5. Geoffery v1: one portrait, dialogue box component, ~25 core copy lines, tip jar (Gold/Platinum), ledger page with fixed thresholds.
6. **Deferred:** accounts, alerts, watchlists, supporter/patron subscriptions, share cards, sentiment features, native app, percentile ledger switch. Launch is account-free: ads + tips only — prove oracle usage before building billing.
