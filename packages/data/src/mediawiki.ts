// OSRS Wiki update pages via the MediaWiki API (spec §3/§6) — never HTML scraping.
// We extract a SHORT ORIGINAL summary for display and keep the raw quote only for
// the classifier's provenance (CC BY-NC-SA: signal, never republication).

import { createHash } from "node:crypto";

const WIKI_API = "https://oldschool.runescape.wiki/api.php";
const WIKI_PAGE_BASE = "https://oldschool.runescape.wiki/w/";

export type UpdateKind = "upcoming" | "recent" | "past";

export interface WikiUpdate {
  id: string;
  page: string;
  title: string;
  summary: string;
  quote: string;
  kind: UpdateKind;
  publishedAt: number | null;
  discoveredAt: number;
  wikiUrl: string;
}

export function currentYearPage(now = new Date()): string {
  return String(now.getUTCFullYear());
}

/** The three source pages the spec names. */
export function sourcePages(now = new Date()): string[] {
  return ["Upcoming_updates", "Updates", currentYearPage(now)];
}

interface ParseResponse {
  parse?: { wikitext: string; sections?: unknown[] };
  error?: { info?: string };
}

async function fetchWikitext(page: string, userAgent: string): Promise<string> {
  const url = `${WIKI_API}?action=parse&page=${encodeURIComponent(page)}&format=json&prop=wikitext&formatversion=2`;
  const res = await fetch(url, { headers: { "User-Agent": userAgent }, redirect: "follow" });
  if (!res.ok) throw new Error(`MediaWiki ${res.status} for ${page}`);
  const data = (await res.json()) as ParseResponse;
  if (data.error) throw new Error(`MediaWiki error for ${page}: ${data.error.info}`);
  return data.parse?.wikitext ?? "";
}

const HEADING = /^(==+)\s*(.+?)\s*\1\s*$/gm;

function splitSections(wikitext: string): { heading: string; body: string }[] {
  const out: { heading: string; body: string }[] = [];
  let lastEnd = 0;
  let lastHeading = "(intro)";
  for (const m of wikitext.matchAll(HEADING)) {
    const body = wikitext.slice(lastEnd, m.index).trim();
    if (body) out.push({ heading: lastHeading, body });
    lastHeading = m[2]!.trim();
    lastEnd = m.index! + m[0].length;
  }
  const tail = wikitext.slice(lastEnd).trim();
  if (tail) out.push({ heading: lastHeading, body: tail });
  return out;
}

/** Strip wiki markup to a short, original-phrasing factual summary. */
export function shortSummary(body: string, maxChars = 400): string {
  let s = body
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\{\{[^}]+\}\}/g, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > maxChars) s = s.slice(0, maxChars).replace(/\s+\S*$/, "") + "…";
  return s;
}

function updateId(page: string, heading: string): string {
  const h = createHash("sha1").update(`${page}::${heading}`).digest("hex").slice(0, 16);
  return `${page.toLowerCase()}-${h}`;
}

function classifyKind(page: string): UpdateKind {
  if (page === "Upcoming_updates") return "upcoming";
  if (page === "Updates" || /^\d{4}$/.test(page)) return "recent";
  return "past";
}

/** Poll all source pages and return parsed update entries (deduped by id). */
export async function fetchWikiUpdates(userAgent: string, now = Math.floor(Date.now() / 1000)): Promise<WikiUpdate[]> {
  const seen = new Map<string, WikiUpdate>();
  for (const page of sourcePages()) {
    let wikitext: string;
    try {
      wikitext = await fetchWikitext(page, userAgent);
    } catch {
      continue; // one bad page never blocks the others
    }
    const kind = classifyKind(page);
    for (const { heading, body } of splitSections(wikitext)) {
      if (heading === "(intro)" || /^(references|see also|navigation)$/i.test(heading)) continue;
      const summary = shortSummary(body);
      if (summary.length < 12) continue;
      const id = updateId(page, heading);
      if (seen.has(id)) continue;
      seen.set(id, {
        id,
        page,
        title: heading,
        summary,
        quote: body.slice(0, 4000),
        kind,
        publishedAt: null,
        discoveredAt: now,
        wikiUrl: `${WIKI_PAGE_BASE}${encodeURIComponent(page)}`,
      });
    }
  }
  return [...seen.values()];
}
