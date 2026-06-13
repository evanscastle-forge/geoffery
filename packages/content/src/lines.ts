// The sole source of Geoffery's words (spec §9). No string he speaks is defined
// anywhere else. Voice (revised 2026-06-12, owner directive): formally servile,
// dry wit, genuinely funny — never stuffy or pompous; he lands jokes, not lectures.
// Deadpan, short sentences, self-deprecating about the wage. Addresses the user
// NEVER by gendered term — no "sir"/"madam"; the user's gender is unknown (owner
// directive 2026-06-12). Servility survives without it. Tone is action-first:
// verdicts name the move (buy/hold/sell/wait). Tone rule reversed 2026-06-12.

export const SITE = {
  name: "Geoffery",
  domain: "geoffery.gg",
  tagline: "A ledger-keeper for the Grand Exchange.",
  // The spelling joke is the point: GE-OFFER-Y.
  spellingNote: "Yes — Geoffery. The 'offer' is the point. I have made my peace with it.",
  // Owner's exact wording (D-FEEDBACK-002, 2026-06-12).
  footerDisclaimer:
    "Not affiliated with, endorsed by, or associated with Jagex. Geoffery can be wrong, always double check his predictions.",
};

export const HOME = {
  intro:
    "Geoffery, at your service. Name an item and I shall tell you what the market has been up to. Ring the bell and I shall tell you what I'd offer — that part I am rather good at.",
  searchPlaceholder: "Name an item, if you please.",
  freshnessPrefix: "Figures updated",
  browseHeading: "A few items of note",
};

export const GAUGE = {
  good: {
    label: "Buy",
    blurb: "Buy. The asking is below where it has lately sat, and bargains rarely wait to be admired.",
  },
  average: {
    label: "Hold",
    blurb: "Hold. It is priced about where it has been all month; nothing here requires heroics.",
  },
  poor: {
    label: "Sell",
    blurb: "Sell. It is dearer than it has lately been, and dearer rarely lasts.",
  },
  unsettled: {
    label: "Wait",
    blurb: "Wait. The figures are flailing about today, and I refuse to chase them up the stairs.",
  },
  // axis labels for the 2x2 regime
  regime: {
    buyer: "a buyer's market",
    seller: "a seller's market",
    balanced: "a balanced market",
    steady: "steady",
    volatile: "volatile",
  },
  youAreHere: "the current price",
  iqrNote: "The shaded band is where this item has spent most of the last thirty days. It does like to wander.",
};

export const BELL = {
  ringLabel: "Ring the bell",
  ringAria: "Ring Geoffery's bell to consult on a price",
  // Short witty sublabels for the compact header bell. The site rotates them; each
  // is one line, gender-neutral, and stands alone (no address term). Surfaced as the
  // button's caption/tooltip and echoed when the dialogue opens (see design brief).
  ringQuips: [
    "He's standing right there anyway.",
    "No appointment necessary.",
    "The quill is already inked.",
    "He pretends to mind. He does not.",
    "Eight figures fetched per pot of tea.",
    "It's the only exercise he gets.",
    "He answers faster than the post.",
    "Go on. He has been polishing it.",
    "The bell works; the wages do not.",
    "He has read the figures twice already.",
    "One ring. He does the rest.",
    "He was hired to be rung at.",
    "Interrupting is, technically, his job.",
    "He's been waiting. Politely.",
    "Cheaper than a second opinion.",
    "The ledger is open to the right page.",
    "He'll feign surprise. He won't be.",
    "Faster than asking a friend who plays.",
    "He keeps the kettle on for exactly this.",
    "A coin a month buys this much, at least.",
    "He has an opinion. He's been holding it.",
    "Ring it before he reshelves everything.",
    "He does not nap. He merely rests his eyes.",
    "Yes, he heard you the first time. Ring anyway.",
    "It is the most fun the bell will have all day.",
    "He counted the items so you needn't.",
    "Disturb him. He has nothing better, and less pay.",
  ],
  // Greeting when an item is already implied (item page).
  greetItem: (item: string) => `You rang? Ah — the ${item}. Buying or selling?`,
  // Greeting when no item is in hand (homepage / non-item page).
  greetGeneric: "You rang? Name the item and I shall do the running.",
  pickItemPrompt: "Name an item, if you please.",
  buy: "Buying",
  sell: "Selling",
  // Time-tolerance prompts differ per side (spec §5).
  buyWhenPrompt: "And when do you need it in hand?",
  sellWhenPrompt: "And how swiftly do you need the gold? Be honest.",
  // Four fill horizons (each targets a ~90% chance to fill within the window).
  tolerance: {
    instant: { label: "Right now", aside: "within the half-minute" },
    hours: { label: "A few hours", aside: "before the day is out" },
    patient: { label: "A day or two", aside: "a day or three — how civilised" },
    extended: { label: "A really long time", aside: "a month, if that's what it takes" },
  },
  // Recommendation templates. {price} is the rounded gp figure; {item} the name.
  recBuy: (item: string, price: string) =>
    `For the ${item}, place a buy offer at ${price} gp.`,
  recSell: (item: string, price: string) =>
    `For the ${item}, place a sell offer at ${price} gp.`,
  // Fair-price templates — when the market is already a fair offer, don't over-manage.
  recFairBuy: (item: string, price: string) =>
    `Market price is a fair offer for the ${item} — buy at ${price} gp and move on.`,
  recFairSell: (item: string, price: string) =>
    `Market price is a fair offer for the ${item} — sell at ${price} gp and be done.`,
  // Confidence statement drawn from scored cohorts.
  confidence: (filled: number, total: number, hours: string) =>
    `Offers I have placed so — ${describeRate(filled, total)} — have filled ${hours}. I keep score on myself; somebody has to.`,
  confidenceUntested:
    "I have not placed enough offers like this one to quote you an honest fill rate. Give me time — I am new here, and I intend to be insufferably accurate.",
  // Regime coloring appended to the recommendation.
  regimeNote: (power: string, stability: string) =>
    `It is ${power}, and ${stability === "volatile" ? "a twitchy one — I should not dawdle" : "a calm one — dawdle freely"}.`,
  // News acknowledgement (neutral, hedged — never directional).
  newsNote: "There is news that may touch this item. I read it so you needn't; I still will not bet on it.",
  // The metered-service limit, delivered in character — and the door it opens (owner
  // feedback 2026-06-12: the limit redirects to the tip jar, never a dead end).
  limitReached: (n: number) =>
    `You have rung ${numberWord(n)} today. The bell is fine; I am winded. Do return on the morrow.`,
  limitTipCta:
    "Unless, of course, you cared to keep me at the desk — the tip jar is just here, and on my wages a single coin goes remarkably far.",
  // Canonical refusal to speculate (spec §6) — lightened, meaning intact.
  noSpeculation: "I keep accounts. I do not gamble — you have seen my wages.",
  verifyLink: "The figures, should you wish to check my sums. Someone ought to.",
  // Fallbacks the Bell may need mid-flow (gender-neutral; were hardcoded in the script).
  noLedger: "My ledger has nothing on that item yet.",
  noFigures: "I have not the figures to advise that honestly.",
};

export const PAGES = {
  // Methodology is deliberately plainer than the rest of the house: it exists to
  // reassure people Geoffery isn't guessing. Short, no theatre, no detail dump.
  methodology: {
    title: "How the ledger is kept",
    intro:
      "Every figure here is arithmetic on real market data — recent prices and volumes, compared against the last thirty days. No guesswork, no gut feel. What I recommend, I write down and check.",
    accuracyHeading: "The fill record",
    accuracyIntro:
      "Every recommendation is recorded as a prediction, then checked against what the market actually did. The results are below — the hits and the misses alike.",
  },
  money: {
    title: "How this is paid for",
    wage: "My wage is one gold a month — a single coin. Everything about the market is free, and nothing now free will move behind a paywall.",
    tipsHeading: "If you should care to tip",
    tipsDisclosure:
      "At present, a tip buys my gratitude and a place amongst my esteemed patrons — nothing else. No features, no priority, no secret menu. When accounts arrive, a tip will purchase a month of supporter's service; today it does not, and I would rather say so before you part with the coin than after.",
    // Tip tiers (owner directive 2026-06-12: renamed off "Gold/Platinum"). Labels and
    // blurbs in Geoffery's voice; web-app renders these in place of the old hardcoded
    // "Gold $1 / Platinum $10". Amounts are USD; "name" is the on-button coin label.
    tiers: [
      {
        id: "coin",
        name: "1 Gold piece",
        amount: "$1",
        blurb: "A single coin — my whole month's wage, in fact. It would buy you a great deal of gratitude.",
      },
      {
        id: "dozen",
        name: "12 Gold Pieces",
        amount: "$10",
        blurb: "A full year of me, paid in advance. I should be obliged, and quietly alarmed.",
      },
    ],
    // Tips require an account (owner decision D-MONEY-001, 2026-06-12).
    accountRequired:
      "Before a coin enters the jar, the household must know whose coin it is. Make yourself an account first, if you please — it is quick, and I ask no awkward questions.",
  },
  ledger: {
    title: "Patrons",
    intro:
      "Those who keep me in ink. Listed by standing, never by sum — what a household gives is its own affair, and I am paid to be discreet. Underpaid, in fact.",
    emptyState: "The ledger awaits its first name. No pressure whatsoever.",
  },
  contact: {
    title: "Contact",
    line:
      "You wish to go past me, to the employer themselves? Very well. I shall warn you only that they answer correspondence rather less promptly than I fetch figures — and I fetch eight per pot of tea.",
    cta: "email support",
  },
  notFound: {
    title: "Not in the ledger",
    line:
      "I have searched the ledger twice and find nothing under that heading. Name the item plainly and I shall try again.",
  },
  // Profile is a prototype — real accounts and charging arrive later (D-MONEY-001).
  profile: {
    title: "Your profile",
    intro:
      "Welcome back — or welcome, if this is the first I am seeing of you. This page is a sketch of what is coming: a tip jar that fills as you keep me in ink, and a few preferences. Nothing here spends real coin yet.",
    jarHeading: "Your tip jar",
    jarNote:
      "How full it sits depends on what you have given, less what time has quietly drawn down. A demonstration, for now.",
    settingsHeading: "Preferences",
    prototypeNote:
      "A prototype. There is no account to log into yet and no coin changes hands — when accounts arrive, this is where they will live.",
    jarStates: ["Empty", "A few coins", "Full", "Overflowing"],
  },
};

export const NEWS = {
  recentNotice: "A recent update may affect this item.",
  upcomingNotice: "An upcoming update may affect this item.",
  provenancePrefix: "Per the wiki:",
};

// ---- small helpers (still Geoffery's voice, kept here so copy stays in one place) ----

function describeRate(filled: number, total: number): string {
  if (total === 0) return "as yet untested";
  const tenths = Math.round((filled / total) * 10);
  if (tenths >= 10) return "near every time";
  if (tenths <= 1) return "but rarely";
  const plain = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
  return `${plain[tenths]} times in ten`;
}

function numberWord(n: number): string {
  const words = ["no", "once", "twice", "thrice", "four times", "five times", "six times", "seven times", "eight times", "nine times", "ten times"];
  return words[n] ?? `${n} times`;
}

export const TOLERANCE_WINDOW_PHRASE: Record<string, string> = {
  instant: "within the minute",
  hours: "within the day",
  patient: "within a few days",
};
