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
  // Per-item-page disclaimer (compliance): make the not-advice stance explicit near the verdict.
  adviceDisclaimer:
    "Educational, not financial advice — this is an in-game market that can move against any figure, and Geoffery can be wrong. Check the live price before you trade.",
};

export const HOME = {
  intro:
    "Geoffery, at your service. Name an item and I shall tell you what the market has been up to. Ring the bell and I shall tell you what I'd offer — that part I am rather good at.",
  searchPlaceholder: "Name an item, if you please.",
  freshnessPrefix: "Figures updated",
  browseHeading: "A few items of note",
};

// A small lineup of witty, page-aware asides (owner directive 2026-06-14). One is
// picked at random per visit on each non-home page; the home page stays static.
export const SAYINGS: Record<string, string[]> = {
  item: [
    "One item, thirty days of its history, and my opinion.",
    "I have read this item's figures so you needn't.",
    "The whole of its recent life, in a few lines.",
    "Everything I know about this, on a single page.",
  ],
  notFound: [
    "I have looked twice. It is not here.",
    "Even my ledger keeps a few blank pages.",
    "Nothing under that heading, I'm afraid.",
    "A dead end — but a politely-kept one.",
  ],
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
  // Three-level market-character badge on the item page (owner directive 2026-06-13).
  volatility: { steady: "Steady", some: "Some volatility", high: "Highly volatile" },
  // Directional 30-day trend label, shown instead of the volatility badge when an item is
  // clearly trending (owner directive 2026-06-18); the % is appended on the page.
  trend: { falling: "Falling", rising: "Rising" },
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
  // Canonical refusal to speculate (spec §6) — lightened, meaning intact.
  noSpeculation: "I keep accounts. I do not gamble — you have seen my wages.",
  startOver: "Start Over",
  visitItem: "Visit Item Page",
  // Fallbacks the Bell may need mid-flow (gender-neutral; were hardcoded in the script).
  noLedger: "My ledger has nothing on that item yet.",
  noFigures: "I have not the figures to advise that honestly.",
};

// ---- Legal pages (privacy, terms, cookies). Terse plain-legal copy — NOT Geoffery's voice
// (owner directive 2026-06-18). Every claim must stay true to what the code actually does.
export interface DocLink {
  href: string;
  text: string;
  external?: boolean;
}
export interface DocSection {
  h: string;
  p: string | string[];
  link?: DocLink;
}
export interface DocPage {
  title: string;
  updated: string;
  intro: string;
  sections: DocSection[];
  contactLine: string;
}

const GOOGLE_PARTNER_URL = "https://policies.google.com/technologies/partner-sites";

export const PRIVACY: DocPage = {
  title: "Privacy Policy",
  updated: "Last updated 18 June 2026.",
  intro: "This policy explains what data geoffery.gg collects and how it is used.",
  sections: [
    {
      h: "Data collected",
      p: [
        "Consultations (the item, buy or sell, time tolerance, and the suggested price) are logged anonymously to measure recommendation accuracy. No account, name, or email is required or collected.",
        "A first-party cookie, geoffery_cid, stores a random identifier used to group consultations. It contains no personal data and is not used to track you across other sites.",
        "If you tip, payment is processed by Stripe; this site never receives your card details. A name entered at checkout may appear on the public patrons list.",
      ],
    },
    {
      h: "Advertising and cookies",
      p: [
        "This site shows ads through Google AdSense. Google and its partners may use cookies to serve and measure ads. Where required by law, consent is requested before advertising cookies are set, via Google's consent message.",
        "You can opt out of personalised advertising in your Google Ad Settings, and clear or block cookies in your browser at any time. See the cookies page for the full list.",
      ],
      link: { href: GOOGLE_PARTNER_URL, text: "How Google uses information from sites that use its services", external: true },
    },
    {
      h: "Your rights and contact",
      p: "To request access to, or deletion of, data associated with you, use the contact below. This site is not directed at children under 13. If this policy changes, the date above is updated.",
    },
  ],
  contactLine: "Contact:",
};

export const TERMS: DocPage = {
  title: "Terms of Use",
  updated: "Last updated 18 June 2026.",
  intro: "By using geoffery.gg you agree to these terms.",
  sections: [
    {
      h: "Not financial advice",
      p: "All figures, gauges, and recommendations are estimates based on past in-game market data, provided for information only. They are not financial advice. Prices can move against any figure shown, and trading decisions are your own.",
    },
    {
      h: "No warranty",
      p: "The site is provided “as is”, without warranty of any kind. No guarantee is made that figures are accurate or current, or that the site will be available. To the fullest extent permitted by law, no liability is accepted for any loss arising from use of the site.",
    },
    {
      h: "Acceptable use",
      p: "Do not abuse, overload, or attempt to disrupt the site, or redistribute its data as your own.",
    },
    {
      h: "Data and trademarks",
      p: "Price data is sourced from the OSRS Wiki real-time price API under its CC BY-NC-SA licence. RuneScape and Old School RuneScape are trademarks of Jagex Limited; this site is independent and not affiliated with, endorsed by, or associated with Jagex.",
    },
  ],
  contactLine: "Contact:",
};

export interface CookieRow {
  name: string;
  party: string;
  purpose: string;
  duration: string;
}
export interface CookiePage {
  title: string;
  updated: string;
  intro: string;
  colName: string;
  colParty: string;
  colPurpose: string;
  colDuration: string;
  cookies: CookieRow[];
  storageNote: string;
  manageNote: string;
  privacyNote: string;
  contactLine: string;
}

export const COOKIES: CookiePage = {
  title: "Cookie Policy",
  updated: "Last updated 18 June 2026.",
  intro: "This site uses the cookies listed below.",
  colName: "Cookie",
  colParty: "Set by",
  colPurpose: "Purpose",
  colDuration: "Duration",
  cookies: [
    {
      name: "geoffery_cid",
      party: "First-party",
      purpose: "A random identifier used to group consultations for accuracy measurement. Contains no personal data.",
      duration: "1 year",
    },
    {
      name: "Google AdSense cookies",
      party: "Third-party (Google)",
      purpose: "Serve and measure advertising, subject to consent where required by law.",
      duration: "Set by Google",
    },
  ],
  storageNote:
    "A service-worker cache is also stored in your browser so the site loads quickly and works offline; it holds no personal data.",
  manageNote:
    "You can clear or block cookies in your browser, and manage advertising consent through Google's prompt, at any time.",
  privacyNote: "See the privacy policy for details.",
  contactLine: "Contact:",
};

export const PAGES = {
  // The About page speaks directly to the reader — plainer and more serious than the
  // rest of the house (owner directive 2026-06-14): what it does, how it works, who makes it.
  about: {
    title: "About Geoffery",
    whatHeading: "What it does",
    whatBody:
      "Every tradeable item gets a deal gauge: the current price set against where it has actually traded over the last thirty days. Lower in that range is a better moment to buy; higher, a better moment to sell. Search any item to see its gauge, its recent price history, and a read on how volatile its market is.",
    bellHeading: "The recommendations",
    bellBody:
      "Ring the bell on any item and say how quickly you need to trade. Geoffery weighs that against how the item has actually been filling and suggests a price — closer to the going rate if you're in a hurry, more favourable if you can wait. Every recommendation is written down and scored against what the market then does.",
    whoHeading: "Who makes it",
    whoBody:
      "Geoffery is built and run by one person, as a labour of interest. It is not affiliated with, endorsed by, or associated with Jagex. Prices come from community-blessed sources (the OSRS Wiki's real-time price API); the character and the artwork are original.",
    contactHeading: "Get in touch",
    contactBody:
      "Found a bug, have an idea, or just want to say hello? Email is the surest way to reach the person behind Geoffery.",
    contactCta: "Email support",
  },
  tips: {
    title: "How this is paid for",
    // The tips page shows a random one of these as Geoffery's dialogue, a new pick per page
    // load (owner directive 2026-06-18). Infinitive phrases — each follows `usesIntro`.
    usesIntro: "The jar empties on the first of each month. Geoffery uses the money to ",
    uses: [
      "buy out the local supply of tea leaves",
      "hire a butler for himself",
      "make inexplicably massive investments in flatpack chairs",
      "upgrade his white serving gloves to “best-in-slot”",
      "pay off his tab at the Blue Moon Inn",
      "go on a “tipping spree” to the estate agent",
      "import premium polishing wax",
      "expand an elaborate silk scarf collection",
      "pay a bard for a bespoke anthem",
      "commission a pensive portrait of himself",
      "restock the good ink, which the figures demand",
      "bribe the Lumbridge sage for market gossip",
      "acquire a slightly grander quill",
      "reupholster his favourite chair",
      "order monocle polish in bulk",
      "fund a second bell, in case the first wears out",
      "quietly settle a wager he insists was “research”",
      "subscribe to the Varrock Herald for the classifieds",
    ],
    tipsHeading: "The tip jar",
    donorsHeading: "Patrons of the month",
    monthLabel: "Showing",
    noDonors: "No names in the jar yet this month. It would suit you rather well up here.",
    tippedNote:
      "Your coin is in the jar — you have my sincere thanks. It buys you nothing the next visitor doesn't already have; a tip is a gift, never a toll. The market stays free for all, always — ring as often as you please.",
    tipCancelled: "No harm done — the jar is still here whenever the mood takes you.",
    tipError: "The counting-house did not answer just now. Do try again in a moment.",
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

export const TOLERANCE_WINDOW_PHRASE: Record<string, string> = {
  instant: "within the minute",
  hours: "within the day",
  patient: "within a few days",
};
