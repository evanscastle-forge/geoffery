// Client-side state machine for the Butler's Bell. Thin: all copy comes from the
// server-rendered #bell-copy payload (which is sourced from @geoffery/content).
// Logs each consultation as a falsifiable prediction (fire-and-forget POST to the
// consult worker); the soft meter is cookie/localStorage and trivially evadable
// by design (spec §5).

import { memberStar } from "./memberStar.ts";

type Side = "buy" | "sell";
type Tolerance = "instant" | "hours" | "patient";

interface RecPayload {
  slug: string;
  name: string;
  band: string;
  regimePower: "buyer" | "seller" | "balanced" | null;
  regimeStability: "steady" | "volatile" | null;
  liquidityBand: "thick" | "medium" | "thin" | null;
  rec: {
    instantBuy: number | null;
    instantSell: number | null;
    hoursBuy: number | null;
    hoursSell: number | null;
    patientBuy: number | null;
    patientSell: number | null;
  };
  hasNews: boolean;
}

interface Copy {
  ringLabel: string;
  ringQuips: string[];
  greetItem: string;
  greetGeneric: string;
  pickItemPrompt: string;
  buy: string;
  sell: string;
  buyWhen: string;
  sellWhen: string;
  tol: Record<Tolerance, { label: string; aside: string }>;
  recBuy: string;
  recSell: string;
  newsNote: string;
  noSpeculation: string;
  noLedger: string;
  noFigures: string;
  verifyLink: string;
  limitReached: string;
  limitTipCta: string;
  regimeNotes: Record<string, string>;
  dailyLimit: number;
}

const CONSULT_URL = "/api/consult";
const METER_KEY = "geoffery_meter";

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function meterCount(): number {
  try {
    const raw = JSON.parse(localStorage.getItem(METER_KEY) || "{}");
    return raw.day === todayKey() ? raw.n || 0 : 0;
  } catch {
    return 0;
  }
}
function meterInc(): void {
  try {
    localStorage.setItem(METER_KEY, JSON.stringify({ day: todayKey(), n: meterCount() + 1 }));
  } catch {
    /* meter is best-effort */
  }
}

function gp(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

export function initBell(): void {
  const ring = document.getElementById("bell-ring");
  const panel = document.getElementById("bell-panel");
  const close = document.getElementById("bell-close");
  const lineEl = document.getElementById("bell-line");
  const choicesEl = document.getElementById("bell-choices");
  const searchWrap = document.getElementById("bell-search");
  const searchInput = document.getElementById("bell-search-input") as HTMLInputElement | null;
  const resultsEl = document.getElementById("bell-search-results");
  const copyEl = document.getElementById("bell-copy");
  if (!ring || !panel || !lineEl || !choicesEl || !searchWrap || !searchInput || !resultsEl || !copyEl) return;
  const copy: Copy = JSON.parse(copyEl.textContent || "{}");

  const itemCtx = document.body.dataset.itemSlug
    ? { slug: document.body.dataset.itemSlug!, name: document.body.dataset.itemName || "" }
    : null;

  let rec: RecPayload | null = null;
  let side: Side | null = null;

  function setLine(text: string): void {
    lineEl!.textContent = text;
  }
  function clearChoices(): void {
    choicesEl!.innerHTML = "";
    searchWrap!.hidden = true;
  }
  function choice(label: string, aside: string | null, onClick: () => void): void {
    const b = document.createElement("button");
    b.innerHTML = aside ? `${label}<span class="aside">${aside}</span>` : label;
    b.addEventListener("click", onClick);
    choicesEl!.appendChild(b);
  }
  function ctaLink(label: string, href: string): void {
    const a = document.createElement("a");
    a.className = "bell-cta";
    a.href = href;
    a.textContent = label;
    choicesEl!.appendChild(a);
  }

  async function fetchRec(slug: string): Promise<RecPayload | null> {
    try {
      const res = await fetch(`/rec/${slug}.json`);
      if (!res.ok) return null;
      return (await res.json()) as RecPayload;
    } catch {
      return null;
    }
  }

  function open(): void {
    panel!.hidden = false;
    if (meterCount() >= copy.dailyLimit) {
      clearChoices();
      // The limit is a door to the tip jar, not a wall (owner feedback 2026-06-12).
      setLine(copy.limitReached + " " + copy.limitTipCta);
      ctaLink("The tip jar", "/money/");
      return;
    }
    if (itemCtx) {
      void startWithItem(itemCtx.slug);
    } else {
      startSearch();
    }
  }

  function startSearch(): void {
    rec = null;
    side = null;
    setLine(copy.greetGeneric);
    clearChoices();
    searchWrap!.hidden = false;
    searchInput!.value = "";
    searchInput!.placeholder = copy.pickItemPrompt;
    resultsEl!.innerHTML = "";
    searchInput!.focus();
    void ensureIndex();
  }

  async function startWithItem(slug: string): Promise<void> {
    rec = await fetchRec(slug);
    if (!rec) {
      setLine(copy.noLedger);
      clearChoices();
      return;
    }
    askSide();
  }

  function askSide(): void {
    setLine(copy.greetItem.replace("{item}", rec!.name));
    clearChoices();
    choice(copy.buy, null, () => {
      side = "buy";
      askTolerance();
    });
    choice(copy.sell, null, () => {
      side = "sell";
      askTolerance();
    });
  }

  function askTolerance(): void {
    setLine(side === "buy" ? copy.buyWhen : copy.sellWhen);
    clearChoices();
    (["instant", "hours", "patient"] as Tolerance[]).forEach((t) => {
      choice(copy.tol[t].label, copy.tol[t].aside, () => showRecommendation(t));
    });
  }

  function priceFor(t: Tolerance): number | null {
    const r = rec!.rec;
    const key = `${t}${side === "buy" ? "Buy" : "Sell"}` as keyof typeof r;
    return r[key];
  }

  function showRecommendation(t: Tolerance): void {
    const price = priceFor(t);
    clearChoices();
    if (price == null) {
      setLine(copy.noFigures);
      ctaLink(copy.verifyLink, `/item/${rec!.slug}/`);
      return;
    }
    const tmpl = side === "buy" ? copy.recBuy : copy.recSell;
    let line = tmpl.replace("{item}", rec!.name);

    const regimeKey = `${rec!.regimePower ?? "balanced"}/${rec!.regimeStability ?? "steady"}`;
    const regimeNote = copy.regimeNotes[regimeKey];
    if (regimeNote) line += " " + regimeNote;
    // The price renders in a tabular sans span — pixel digits are ambiguous at
    // this size and the price is the product (geoffery-verdict 2026-06-12, MED-3).
    const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    lineEl!.innerHTML = esc(line).replace("{price}", `<span class="bell-price">${esc(gp(price))}</span>`);

    // The confidence sentence was removed from the rec node (owner feedback
    // 2026-06-12); the fill record lives on the methodology page. The news
    // acknowledgement remains — it is a §6 disclosure, not clutter.
    if (rec!.hasNews) {
      const newsEl = document.createElement("p");
      newsEl.className = "bell-confidence";
      newsEl.textContent = copy.newsNote;
      choicesEl!.appendChild(newsEl);
    }

    meterInc();
    logConsultation(t, price);
    // Every consultation ends on the item page, recommendation above the figures.
    ctaLink(copy.verifyLink, `/item/${rec!.slug}/#consulted=${t}-${side}-${price}`);
  }

  function logConsultation(t: Tolerance, price: number): void {
    // Falsifiable prediction log (fire-and-forget; never blocks the user).
    try {
      navigator.sendBeacon?.(
        CONSULT_URL,
        new Blob(
          [
            JSON.stringify({
              slug: rec!.slug,
              side,
              tolerance: t,
              recommendedPrice: price,
              regimePower: rec!.regimePower,
              regimeStability: rec!.regimeStability,
              liquidityBand: rec!.liquidityBand,
            }),
          ],
          { type: "application/json" },
        ),
      );
    } catch {
      /* logging is best-effort */
    }
  }

  // --- search index (lazy) ---
  let index: { slug: string; name: string; members: boolean }[] | null = null;
  async function ensureIndex(): Promise<void> {
    if (index) return;
    try {
      const res = await fetch("/items.json");
      index = (await res.json()) as { slug: string; name: string; members: boolean }[];
    } catch {
      index = [];
    }
  }
  function renderResults(q: string): void {
    if (!index) return;
    const norm = q.trim().toLowerCase();
    resultsEl!.innerHTML = "";
    if (!norm) return;
    const hits = index.filter((i) => i.name.toLowerCase().includes(norm)).slice(0, 8);
    for (const h of hits) {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.innerHTML = `<span>${h.name}</span>${memberStar(h.members)}`;
      b.addEventListener("click", () => {
        searchWrap!.hidden = true;
        void startWithItem(h.slug);
      });
      li.appendChild(b);
      resultsEl!.appendChild(li);
    }
  }

  searchInput.addEventListener("input", () => renderResults(searchInput.value));

  function closePanel(): void {
    panel!.hidden = true;
    if (quipEchoEl) quipEchoEl.textContent = "";
    advanceQuip();
  }

  // --- the fun (design brief §8): the bell is now compact in the header, so the
  // quip surfaces as the button's title tooltip (rotating) + an echo in the panel
  // when it opens — that's where the joke mainly lands.
  const ico = ring.querySelector<HTMLElement>(".bell-ico");
  const quipEchoEl = document.getElementById("bell-quip-echo");
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hasRung = false;

  const quips = copy.ringQuips ?? [];
  let quipIdx = Math.floor(Math.random() * Math.max(1, quips.length));
  function currentQuip(): string {
    return quips.length ? quips[quipIdx % quips.length]! : "";
  }
  function setQuip(): void {
    if (quips.length) ring!.title = currentQuip();
  }
  function advanceQuip(): void {
    if (!quips.length) return;
    quipIdx = (quipIdx + 1) % quips.length;
    setQuip();
  }
  setQuip();
  // Rotate the tooltip slowly so a repeat visitor gets variety; never while open.
  setInterval(() => {
    if (panel!.hidden) advanceQuip();
  }, 9000);

  function ringShake(): void {
    if (reduceMotion || !ico) return;
    ico.classList.remove("nudge");
    ico.classList.add("ringing");
    setTimeout(() => ico.classList.remove("ringing"), 500);
  }

  // Idle nudge: a polite reminder every 45–75s — tab visible, dialogue closed,
  // and never again once the bell has been rung (he's been heard).
  function scheduleNudge(): void {
    if (reduceMotion || !ico) return;
    setTimeout(() => {
      if (hasRung) return;
      if (document.visibilityState === "visible" && panel!.hidden) {
        ico.classList.add("nudge");
        setTimeout(() => ico.classList.remove("nudge"), 700);
      }
      scheduleNudge();
    }, 45_000 + Math.random() * 30_000);
  }
  scheduleNudge();

  ring.addEventListener("click", () => {
    hasRung = true;
    ringShake();
    if (quipEchoEl) quipEchoEl.textContent = currentQuip(); // the joke lands here
    open();
  });
  close?.addEventListener("click", closePanel);
  panel.addEventListener("click", (e) => {
    if (e.target === panel) closePanel();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel!.hidden) closePanel();
  });
}
