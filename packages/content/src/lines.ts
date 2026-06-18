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
  about: [
    "The page where I stop performing and start explaining.",
    "No theatre here — just the method, and the door.",
    "You wanted to know how the figures are reckoned. Here it is, plainly.",
    "Plainer talk than usual. Do not grow accustomed to it.",
  ],
  money: [
    "A jar, some coins, and my undivided gratitude.",
    "The ink does not buy itself, alas.",
    "Tips fund the ink; the ink funds the figures.",
    "Underpaid, yes — but discreet about it.",
  ],
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

// ---- Legal / compliance pages (privacy, terms, cookies). Plainer than the rest of
// the house — these exist to be clear and accurate (and to satisfy ad-network review),
// with only a light touch of Geoffery in the intros. Every claim here must stay true to
// what the code actually does; reviewed by design/compliance before shipping.
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
const GOOGLE_ADSETTINGS_URL = "https://adssettings.google.com";

export const PRIVACY: DocPage = {
  title: "Privacy",
  updated: "Last updated 18 June 2026.",
  intro:
    "I keep careful accounts — and I am just as careful with yours. I gather as little as I can, sell none of it, and set the whole of it out here, plainly.",
  sections: [
    {
      h: "What I record",
      p: [
        "When you ring the bell and I give a recommendation, I log that consultation: the item, whether you were buying or selling, how long you said you would wait, the price I suggested, and the market conditions at that moment. I do this to grade myself — every recommendation is later checked against what the market actually did, and the tally is published on the methodology page.",
        "So your own consultations can be grouped together — and for nothing else — your browser is given a random identifier, the geoffery_cid cookie. It is a string of random characters: not your name, not your email, nothing that identifies you. It is never sold, shared, or used to follow you about other sites.",
        "There are no accounts, no logins, and none of my own analytics or tracking.",
      ],
    },
    {
      h: "Tips",
      p: "Tips are handled by Stripe, who process the payment; I never see your card details. If you enter a name at checkout, it may appear on that month's wall of patrons — the only personal detail a tip can surface, and only if you choose to give it. Amounts are never shown publicly.",
    },
    {
      h: "Advertising",
      p: [
        "To help cover its costs, this site shows ads from Google AdSense. Google and its partners may use cookies to serve and measure those ads.",
        "Where the law requires it — for example in the UK and EU — you are asked to consent before any advertising cookies are set, through Google's consent prompt, and you may change or withdraw that choice at any time.",
      ],
      link: { href: GOOGLE_PARTNER_URL, text: "How Google uses information from sites that use its services", external: true },
    },
    {
      h: "Cookies and storage",
      p: "For the complete list of the cookies and storage this site uses, see the cookies page.",
      link: { href: "/cookies/", text: "the cookies page" },
    },
    {
      h: "Your choices",
      p: [
        "You can clear cookies and site data at any time in your browser's settings; that removes the geoffery_cid identifier, and a fresh one is made the next time you ring the bell.",
        "You can opt out of personalised Google ads, and manage advertising consent through the prompt mentioned above.",
        "To ask what is held about you, or to have it removed, write to me at the address below.",
      ],
      link: { href: GOOGLE_ADSETTINGS_URL, text: "your Google Ad Settings", external: true },
    },
    {
      h: "Children",
      p: "Geoffery is a general-audience tool about a video game's market. It is not directed at children under 13, and I do not knowingly collect their information.",
    },
    {
      h: "Changes",
      p: "If this policy changes, the date above changes with it.",
    },
  ],
  contactLine: "Questions about your privacy go to the same place as everything else:",
};

export const TERMS: DocPage = {
  title: "Terms",
  updated: "Last updated 18 June 2026.",
  intro:
    "Using Geoffery comes with a few plain understandings — no fine-print games, just what you may expect of me and what I ask of you.",
  sections: [
    {
      h: "Using the site",
      p: "Geoffery is free to use for your own trading in Old School RuneScape. Please don't pound the site with automated requests, try to break it, or pass its figures off as your own. Otherwise, enjoy it — that is what it is for.",
    },
    {
      h: "Not financial or trading advice",
      p: [
        "Everything here — the gauges, the prices, and the recommendations from the bell — is arithmetic on past market data, offered for information and entertainment. It concerns an in-game economy, not real money, and it is not financial advice.",
        "The market can and does move against any figure I give. I can be wrong, and on occasion am. Every trade you make is your own decision; always check the live price before you commit to it.",
      ],
    },
    {
      h: "No warranty",
      p: "The site is provided “as is”, without warranty of any kind. I do not guarantee that the figures are accurate or current, nor that the site will always be available. To the fullest extent the law allows, I am not liable for any loss arising from your use of it.",
    },
    {
      h: "Where the data comes from",
      p: "Prices come from the OSRS Wiki's real-time price API and related MediaWiki content, used gratefully under their CC BY-NC-SA licence. The data is a signal I compute upon, never republished wholesale. The character Geoffery and the artwork are original.",
    },
    {
      h: "Not affiliated with Jagex",
      p: "RuneScape and Old School RuneScape are trademarks of Jagex Limited. Geoffery is an independent, unofficial tool — not affiliated with, endorsed by, or associated with Jagex in any way.",
    },
    {
      h: "Changes",
      p: "These terms may change in time; the date above tracks it.",
    },
  ],
  contactLine: "Anything here unclear? Write to me:",
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
  title: "Cookies",
  updated: "Last updated 18 June 2026.",
  intro: "I use as few cookies as I can manage, and none of my own for tracking. Here is the complete list.",
  colName: "Cookie",
  colParty: "Set by",
  colPurpose: "What it is for",
  colDuration: "Kept for",
  cookies: [
    {
      name: "geoffery_cid",
      party: "First-party",
      purpose:
        "A random identifier that groups your own consultations so I can score my recommendations honestly. Not linked to your identity, and never used to follow you across other sites.",
      duration: "1 year",
    },
    {
      name: "Google AdSense cookies",
      party: "Third-party — Google",
      purpose:
        "Set by Google to serve and measure the ads that help fund the site, and only with your consent where the law requires it.",
      duration: "Varies (set by Google)",
    },
  ],
  storageNote:
    "The site also keeps a small cache in your browser (a service worker) so it loads quickly and works offline. That is storage, not a tracking cookie, and it holds nothing personal.",
  manageNote:
    "You can clear or block cookies in your browser whenever you like, and manage advertising consent through Google's prompt. The site keeps working either way — you may simply see less relevant ads.",
  privacyNote: "For what each cookie is used for and the choices you have, see the privacy page.",
  contactLine: "Questions about cookies are welcome:",
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
    overallLabel: "Across every recommendation I have scored",
    toleranceHeading: "By how long you said you'd wait",
    colTolerance: "Patience",
    colSample: "Scored",
    colFillRate: "Filled as advised",
    toleranceLabels: { instant: "Right now", hours: "A few hours", patient: "A day or two", extended: "A long while" },
    untested:
      "I have not scored enough recommendations yet to quote an honest figure. Give me time — I am new here, and I intend to be insufferably accurate.",
    footnote:
      "A recommendation “fills” when the market reached the price I suggested within the window I named. These figures update as more recommendations are scored.",
  },
  // The About page speaks directly to the reader — plainer and more serious than the
  // rest of the house (owner directive 2026-06-14): what it is, how it works, who makes it.
  about: {
    title: "About Geoffery",
    intro:
      "Geoffery is a free price guide and trading assistant for the Old School RuneScape Grand Exchange. It reads the live market, rates whether an item is cheap or dear against its own recent history, and — when you ask — suggests a price to buy or sell at.",
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
  money: {
    title: "How this is paid for",
    // The money page shows a random one of these as Geoffery's dialogue, a new pick per page
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
