# OSRS-WIKI-STYLE — observed design reference

The `design` agent's growing record of what the OSRS Wiki (`https://oldschool.runescape.wiki`)
actually does, observed from the live site (chrome-devtools MCP / WebFetch). The wiki is the
explicit aesthetic north star (owner directive, 2026-06-12): heavy inspiration from its interface
design — palettes, layout rhythm, typography temperature — never the Jagex game art it hosts.

Add an entry whenever you measure something worth keeping. Re-verify dated entries before
relying on them; the wiki's skin evolves.

## Entry format
```
### <what> — observed YYYY-MM-DD
- **Where**: <wiki page + theme (light/dark)>
- **Value**: <hex / px / font stack / structural note>
- **Relevance**: <what on our site this informs>
```

## Palette

### Light theme core surfaces — observed 2026-06-12
- **Where**: /w/Dragon_scimitar, light theme; values from computed styles + the `:root` custom-property dump (274 vars)
- **Value**:
  - `--body-background-color: #c0a886` (page ground, behind a parchment background image `Old_School_RuneScape_Wiki_background.jpg`)
  - `--body-main: #e2dbc8` (content surface; `#content` computes `rgb(226,219,200)`)
  - `--body-light: #d8ccb4` (infobox/wikitable/TOC/navbox bg), `--body-mid: #d0bd97`, `--body-dark: #b8a282` (infobox header, table `th`, navbox title)
  - `--body-border: #94866d` (infobox border computes `1px solid rgb(148,134,109)`)
  - `--sidebar: #cfc08d`; h1 underline computes `1px solid rgb(207,192,141)`
  - `--text-color: #000`, `--byline-color: #4c4c4c`, `--subtle-color: #777`
  - `--link-color: #936039` (computed `rgb(147,96,57)`), `--redlink-color: #ba0000`, `--background-link-color: #52351e`
  - Buttons/progressive: `--button-background / --ooui-progressive: #605443` ("osrsw-brown"), hover `#7e6e58`
- **Relevance**: our parchment panel family — `--panel #e7dfca`, `--panel-mid #dbcfb6`, `--panel-deep #bda687`, `--panel-edge #97876b`, `--link #7a4a26` are house mixes adjacent to these.

### Dark theme core surfaces — observed 2026-06-12
- **Where**: stylesheet module `load.php?modules=wgl.theme.dark&only=styles&skin=vector` (29,776 bytes, 262 vars); the cookie/`?usetheme=dark` toggle did not engage for an anonymous CDP session
- **Value**: the wiki's dark theme is **cool navy-blue, not brown**:
  - `--body-background-color: #071022`, `--body-main: #172136`, `--body-light: #313e59`, `--body-mid / --body-dark: #222e45`, `--body-border: #596e96`
  - `--text-color: #cbd9f4`, `--byline-color: #98a2b6`, `--link-color: #8cabe6`, `--redlink-color: #f26d60`
  - `--button-background / --ooui-progressive: #617ebc`, `--ooui-input: #384766`
  - wikitable: bg `#313e59`, header `#222e45`, alternating `#2a3651`, border `#172136`
- **Relevance**: we deliberately did NOT adopt the navy — Geoffery's dark ground stays warm
  (`--bg #17120c`) to match the brass/parchment identity; what we take from the wiki dark theme
  is the *structure*: dark ground, lighter raised panels, clearly stepped table tones.

### Wikitable + GE Market Watch colours — observed 2026-06-12
- **Where**: /w/Dragon_scimitar and /w/Grand_Exchange, light theme
- **Value**:
  - light: `--wikitable-bg: #d8ccb4`, `--wikitable-header-bg: #b8a282`, `--wikitable-alternating-bg: #d1c6a6`, `--wikitable-border: #94866d`, `--wikitable-bg-lighter: #e9e3d6`
  - GE module price-direction colours (both themes): `--gemw-positive-color: #6bc71f`, `--gemw-negative-color: #ee4231`, `--gemw-unchanged-color: #3ea6e6`
  - coins (light): `--coins-color: green`, `--coins-pos-color: #014cc0`, `--coins-neg-color: #c02614`; (dark): pos `#3ea6e6`, neg `#ee4231`
- **Relevance**: our `--panel-stripe #d5c9aa`, `--panel-deep #bda687` table treatment and the
  `--trend-up/down/flat` accents (`#74c437 / #e0513f / #4ba0d8`, house-mixed near GEMW).

### Status / messagebox accents — observed 2026-06-12
- **Where**: /w/Dragon_scimitar `:root` dump, light theme
- **Value**: yes/no/maybe table cells `#c3e8a3 / #fbc0ba / #fcea94` with text `#2e5e05 / #801c13 / #786300`; errorbox `#feecea` border `#ee4231`; warningbox `#fef9de` border `#f9d000`
- **Relevance**: pattern for our verdict chips — tinted parchment bg + same-hue dark text
  (our `--good/--good-bg` etc. follow this construction).

### Verdict palette — NON-judgmental retune (owner directive, set 2026-06-12)
> **Partly superseded 2026-06-13** — the gauge bar is now a gold→white ramp and the *sell* side
> (the Sell chip + the falling-price sparkline) moved off teal to neutral. See "Gauge bar —
> gold↔white" below; buy / hold / wait here are unchanged.
- **Why**: owner rejected green→buy / red→sell — "Red has a negative connotation. Selling might
  be good." A verdict chip should name a *move*, not pass a *verdict on the trader*. So the chips
  are now **temperature-coded, not valence-coded**: BUY = warm amber-gold (opportunity, the house
  brass family); SELL = calm teal (the house waistcoat hue — equally a good move); HOLD = a
  low-chroma neutral (steady, nothing to do); WAIT = a pure cool grey (no reading). Red retired
  entirely. Buy and sell are **121° apart in hue** (gold ~43°, teal ~164°) — two genuinely
  distinct, legible families; neither reads as a warning.
- **Values (token KEYS unchanged; only VALUES changed in `packages/content/src/tokens.css`)**:
  | verdict | text token | chip-bg token | AA (text on own bg) |
  |---|---|---|---|
  | buy `--good` | `#82430f` | `--good-bg #f0d9a0` | **5.49:1** |
  | hold `--average` | `#574d3a` | `--average-bg #ded7c4` | **5.78:1** |
  | sell `--poor` | `#1c5659` | `--poor-bg #c2dcd5` | **5.74:1** |
  | wait `--unsettled` | `#454a52` | `--unsettled-bg #d2d2d2` | **5.90:1** |
  All ≥ WCAG AA 4.5:1; ratios computed in-browser (chrome-devtools `evaluate_script`, sRGB
  relative-luminance). Chip backgrounds are deliberately low-contrast against `--panel #e7dfca`
  (1.04–1.14:1) — same construction as the wiki's status cells; web-app frames each chip with a
  `--panel-edge` hairline so it reads as a filled chip, and the chip text carries the verdict word
  so colour is never the only signal. On the dark page, verdict labels should use light variants
  (`#edc063 / #cabf9f / #5fc8c4 / #bfc2c8`, all ≥ 8.5:1 on `--bg`).
- **Sparkline trend tokens also neutralized** — *superseded 2026-06-13; see "Sparkline trend — red/
  green by direction" below.* (same directive — no red on direction either, and to harmonise with the
  verdict temperature). Direction stays legible — warm rises, cool falls.
  Corrected 2026-06-12: the sparkline's **only** render ground is the parchment cards/panels, so
  the tokens are tuned for `--panel`, not the dark page (the earlier light values measured ~1.5:1
  on parchment — nearly invisible). Shipped: `--trend-up #82430f` (warm amber, 5.73:1 on `--panel`),
  `--trend-down #1c5659` (cool teal, 6.26:1), `--trend-flat #6b6150` (warm neutral). `Sparkline.astro`
  now reads these instead of the verdict tokens (resolves the geoffery-verdict MED that they were
  defined but unused).
- **For web-app**: nothing to change in components — they read the token KEYS, which are
  unchanged; the new colours flow through automatically. Verified visually on the live gauge
  (`local/feedback-round-2026-06-12/verdict-chips-on-parchment.png`).

### Gauge bar — gold↔white ramp + neutralized sell (owner directive, 2026-06-13)
- **Why**: the three-stop `--good`(amber)→`--average`(grey)→`--poor`(teal) gauge bar muddied through
  a dark warm-grey midtone. Owner directive: make the bar a **monochromatic gold→white ramp** — BUY =
  gold (low price, left), SELL = white (high price, right) — so the middle never looks muddy.
  the **Sell chip** is neutralized off teal (the trend sparkline is separate — it became red/green by
  direction the same day, see the next entry). Buy keeps its gold family, hold/wait keep their greys.
  Teal is retired from verdicts but stays `--teal` (Geoffery's waistcoat). Still non-judgmental —
  neither end reads as "bad".
- **Bar**: `Gauge.astro .gauge-track` → `linear-gradient(90deg, var(--gauge-buy) 0%, var(--gauge-sell) 100%)`
  with new tokens `--gauge-buy #d9b24c` (yellow gold) + `--gauge-sell #ffffff`. The white sell end is
  pure `#fff`; the track reads against `--panel #e7dfca` via a `--panel-edge` border + an
  `inset 0 0 0 1px rgba(0,0,0,.06)` hairline.
- **Sell side re-neutralized** (values changed in `packages/content/src/tokens.css`):
  | token | was (2026-06-12) | now (2026-06-13) | AA |
  |---|---|---|---|
  | `--poor` (sell text) | `#1c5659` teal | `#2f3e46` cool slate | **9.75:1** on `--poor-bg` |
  | `--poor-bg` (sell chip) | `#c2dcd5` pale teal | `#eef1f3` cool near-white | bordered `#bcc6cc` in `.tag.poor` |
  The near-white Sell chip is ~1.17:1 against `--panel` alone, so it carries a cool `#bcc6cc` border
  (vs the warm `--panel-edge` on the other chips) to read as a filled chip; its dark text is the
  verdict word, so colour is never the only signal. Ratios computed in-browser (chrome-devtools
  `evaluate_script`); verified on item pages at 1440×900 + 390×844 across all four bands.

### Sparkline trend — red/green by direction (owner directive, 2026-06-13)
- **Why**: reverses the 2026-06-12 "no red on direction" for the **trend sparklines** (the item-page
  Recent-trend graphs + the homepage item-of-note cards): green when the overall trend is up, red when
  it is down. This is **price direction, a fact — not a verdict**; the verdict chips and the gauge bar
  stay non-red (a red line means "it fell", not "selling is bad").
- **Values** (`packages/content/src/tokens.css`, consumed only by `Sparkline.astro`): `--trend-up
  #246b27` (green, 4.93:1 on `--panel`), `--trend-down #b3261e` (red, 4.92:1). House-mixed dark — the
  bright GEMW green/red `#74c437 / #e0513f` measure ~1.5:1 on parchment. `--trend-flat #6b6150` stays
  defined but unused (`rising = last >= first`, so flat reads as up/green; a neutral dead-band is a
  trivial future add). Verified at 1440×900 + 390×844 — the homepage cards + the three Recent-trend
  graphs each colour by their own first-vs-last trend.

## Typography

### Font stacks and heading scale — observed 2026-06-12
- **Where**: /w/Dragon_scimitar, light theme, computed styles
- **Value**:
  - body: `"IBM Plex Sans", "Helvetica Neue", Arial, sans-serif`, 16px
  - page h1 (`#firstHeading`): `"PT Serif", Palatino, Georgia, serif`, 28.8px (1.8em), black, 1px bottom rule `#cfc08d`
  - section h2s share the PT Serif treatment with a bottom hairline; body copy is Plex Sans throughout
- **Relevance**: our `--serif` now leads with PT Serif, `--sans` with IBM Plex Sans (both SIL
  OFL, self-hostable) — the exact wiki pairing, legitimately reusable since these are open fonts,
  not Jagex assets.

### Chat font — what actually reads as RuneScape (bake-off, 2026-06-12, D-DESIGN-003)
- **The key finding**: the OSRS chat font (`runescape_uf` / the b12 bitmap) is a **small, BOLD,
  PLAIN bitmap sans** — essentially a bitmap of Helvetica/Arial, crisp and antialiased. It is
  **not** an arcade/blocky/square pixel face. So "make it more video-gamey" is the wrong axis;
  the RS signal is *bold + plain + small*, not *chunky pixels*.
- **Why the first pick missed**: the round-2 bake-off only sampled arcade/display pixel faces —
  Micro 5 (5px grid, ultra-condensed), Pixelify (rounded arcade), VT323 (DOS terminal),
  DotGothic16 (receipt printer), Tiny5, Workbench. All read "generic retro game", none reads RS.
- **The 2026-06-12 audit** rendered candidates on the real chat surface (#c9b896, same line +
  digits) via the chrome-devtools MCP. Results, best→worst for RS-likeness:
  - **Pixel Operator Bold (CC0)** — WINNER. Bold plain bitmap sans, exactly the RS-chat
    temperament; digits unambiguous (fixes Micro 5's "5"≈"S"/"8"); crisp at small sizes.
  - Pixel Operator (regular) — same shape, a touch thin on the tan; Bold wins for contrast.
  - Jersey 15 / 10 — passable but quirky-condensed, less plainly RS.
  - Silkscreen / Bold — forced ALL-CAPS, too sparse; wrong for chat.
  - Pixelify / Micro 5 — arcade; the look being replaced.
  - IBM Plex Sans **Bold** (non-pixel control) — very readable but reads "modern app", NOT RS —
    confirms a pixel/bitmap face *is* required for the RS feel.
- **Shipped**: `--chat-font: "Pixel Operator"`, native 16px grid; body at 18px
  (`--chat-font-size: 1.125rem`), name at 22.4px (`--chat-name-size: 1.4rem`) — crisp, RS-small,
  no oversized legibility floor (Micro 5 had needed ≥1.35rem). Self-hosted woff2, 4.5KB. CC0, so
  no attribution constraint. Boundary intact: a look-alike, not a recreation of the game font.

### The game chatbox (for D-DESIGN-002) — observed 2026-06-12
- **Where**: /w/Chat_Interface (text documentation + interface screenshot on page; observation only)
- **Value** (characterisation, not extraction):
  - the chat area is a light tan parchment panel inside a dark brown bevelled stone/wood frame; six filter buttons run along the bottom
  - chat-log markup is `<col=HEX>` per the wiki; messages in the chat *log* default to white-on-dark in that context, but in the classic tan chatbox: player names near-black, public chat blue, game messages black; over-head/colour-effect default is yellow; effects include red/green/cyan/purple/white
  - NPC dialogue boxes (same family of interface): tan ground, speaker name in dark red, body text black, "Click here to continue"/options in blue
- **Relevance**: our chat tokens — `--chat-surface #c9b896` (tan), `--chat-border #5a4a33` +
  `--chat-border-light #8a7354` (two-tone brown frame), `--chat-name #7a1e12` (dark red),
  `--chat-text #201a10`, `--chat-option #2e3f9e` (blue), `--chat-option-hover #8a2317`.
  All house-mixed nearby values; no game hex codes copied, no sprites.

## Layout & components (infoboxes, tables, navboxes)

### Content density and panel geometry — observed 2026-06-12
- **Where**: /w/Dragon_scimitar and /w/Grand_Exchange, light theme
- **Value**:
  - `#content` padding `20px 24px 24px`, `max-width: none` (full-bleed content column)
  - infobox: `width: 300px`, right-floated, `1px solid #94866d`, header band `#b8a282`, square corners (no border-radius)
  - wikitable: `border-collapse: collapse`, `th` padding `2.88px 21px 2.88px 5.76px` (sortable arrow gutter), `td` padding `2.88px 5.76px`, every cell hairlined `1px solid rgb(148,134,109)` — dense, ledger-like rows
  - striping comes from `--wikitable-alternating-bg` on alternating rows, not row hover
- **Relevance**: our panels should square up (`--radius` dropped 6px→4px, `--radius-lg`
  12px→8px), use `--panel-edge` 1px frames with a `--panel-deep` header band, and our data
  tables should be tighter (4–6px vertical padding) with `--panel-stripe` alternation.

## Font licensing — commercial-use confirmation (owner question, 2026-06-12)

- **Owner asked**: "The items use the wiki font. Is it okay to use the wiki font for a commercial
  project?"
- **Answer: yes, no IP issue.** What the wiki uses for *interface text* (and what we use) are
  **open fonts**, not Jagex assets:
  - **PT Serif** (headings) — SIL Open Font License 1.1.
  - **IBM Plex Sans** / **IBM Plex Mono** (body, mono) — SIL Open Font License 1.1.
  - **Pixel Operator** / Pixel Operator Bold (chat font) — CC0 / public domain.
  The SIL OFL and CC0 both **explicitly permit commercial use, embedding, modification, and
  self-hosting**, at no cost and (for CC0) without attribution. The OFL only forbids selling the
  font files on their own and reserves the reserved font name — neither of which we do. We
  self-host the actual `.woff2` files; nothing is hot-linked from the wiki.
- **The boundary that matters**: the wiki's *interface* fonts are community/open choices, not
  Jagex property. The thing we must never ship is the **actual in-game RuneScape font files**
  (e.g. `runescape_uf` / the b12 bitmap) — those are Jagex assets. We don't; the chat font is a
  CC0 *look-alike* (Pixel Operator), chosen precisely so we echo the RS temperament without the
  asset (D-DESIGN-002/003). Compliance veto: clears. See also `.claude/agents/design/compliance.md`.

## Chat font (D-DESIGN-002) — candidate bake-off, observed 2026-06-12

> **SUPERSEDED by D-DESIGN-003 (the section above, "Chat font — what actually reads as
> RuneScape").** This earlier bake-off chose Micro 5 with a 1.35rem floor; that pick was rejected
> for reading "generic retro game", and the shipped font is **Pixel Operator Bold** at an 18px
> body / 22px name. Kept below only as the record of how the first pick missed.

- **Where**: dev site homepage dialogue (`http://localhost:4321/`), candidates injected via
  Google Fonts and screenshotted at the live chat size (`.dialogue-text` computed 17.92px
  baseline). Screenshots archived in `local/feedback2-2026-06-12/font-*.png`.
- **Values** (all OFL on Google Fonts; the actual game font remains off-limits):
  - **Pixelify Sans** (outgoing): blocky arcade-rounded; reads modern indie-game, not RS dialog.
  - **VT323**: tall, narrow, DEC-terminal; legible at 1.25rem but reads DOS, not parchment.
  - **DotGothic16**: dot-matrix gothic; very legible at 1.1rem, even colour — but reads
    receipt-printer/Japanese console rather than RS chat.
  - **Tiny5**: 5px grid, noisy edges at body sizes; rejected for paragraph legibility.
  - **Micro 5** (chosen): 5px-grid design by Sarah Cadigan-Fried; squat rounded pixels,
    condensed rhythm, small-cap-flavoured capitals — closest temperament to RS dialog text
    while being an original design. Illegible at 1.1rem (grid too coarse); good from ~1.35rem.
    Tokens now carry `--chat-font-size: 1.35rem` as the floor.
  - **Workbench**: decorative dotted variable font; display-only, rejected for body.
- **Relevance**: `--chat-font` now leads with "Micro 5" (Pixelify Sans retained as first
  fallback until web-app self-hosts the new file).
