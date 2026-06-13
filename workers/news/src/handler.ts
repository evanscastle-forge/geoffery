// News worker (spec §6): poll the OSRS Wiki update pages, diff into wiki_updates,
// and classify each new entry ONCE via Claude Haiku against a CLOSED vocabulary
// (the item catalog), requiring a quoted justification + confidence. Only
// high-confidence (>=0.6) associations are surfaced. Permanent cache: classified
// rows are never reclassified unless the classifier version bumps.
//
// Graceful degradation (spec §6, D-LOCAL-002): with no ANTHROPIC_API_KEY, updates
// are still polled and stored — they simply lack annotations. No user-facing path
// ever waits on the LLM.

import Anthropic from "@anthropic-ai/sdk";
import {
  fetchWikiUpdates,
  heartbeat,
  insertAssociation,
  itemNameCatalog,
  markClassified,
  recordLlmUsage,
  unclassifiedUpdates,
  upsertWikiUpdate,
  type SqlStore,
} from "@geoffery/data";

export const CLASSIFIER_VERSION = 1;
const MIN_CONFIDENCE = 0.6; // display threshold
const MAX_ITEMS_PER_UPDATE = 25;
const CATALOG_WINDOW = 800;
const MODEL_DEFAULT = "claude-haiku-4-5-20251001";

const SYSTEM_PROMPT = `You are an Old School RuneScape Grand Exchange analyst. You will be given:
1. A short description of an in-game update or upcoming update.
2. A closed list of in-game item names.

Identify which items from the list — if any — this update may plausibly affect the
price of. Be conservative: only flag items whose names appear in the update text or
whose mechanics the update directly touches.

You MUST select item names verbatim from the supplied list. Do not invent or
paraphrase item names. If nothing applies, return an empty list.

For each affected item produce: {"item_name": "<exact name>", "confidence": <0..1>,
"quote": "<single line from the update text justifying the link>"}.
Reply with a JSON array of these objects and nothing else.`;

export interface NewsResult {
  polled: number;
  classified: number;
  associations: number;
  stub: boolean;
}

interface Assoc {
  item_name?: string;
  confidence?: number;
  quote?: string;
}

export async function runNews(
  store: SqlStore,
  userAgent: string,
  apiKey: string | undefined,
  model: string = MODEL_DEFAULT,
  maxUpdates = 25,
  now: number = Math.floor(Date.now() / 1000),
): Promise<NewsResult> {
  try {
    // 1) Poll + diff.
    const updates = await fetchWikiUpdates(userAgent, now);
    store.transaction(() => {
      for (const u of updates) upsertWikiUpdate(store, u);
    });

    // 2) Classify — graceful degradation when no key.
    if (!apiKey) {
      heartbeat(store, "news", true);
      return { polled: updates.length, classified: 0, associations: 0, stub: true };
    }

    const client = new Anthropic({ apiKey });
    const catalog = itemNameCatalog(store);
    const byNameLc = new Map(catalog.map((c) => [c.name.toLowerCase(), c.id]));
    const windows: { id: number; name: string }[][] = [];
    for (let i = 0; i < catalog.length; i += CATALOG_WINDOW) windows.push(catalog.slice(i, i + CATALOG_WINDOW));

    const pending = unclassifiedUpdates(store, maxUpdates);
    let classified = 0;
    let associations = 0;
    let requests = 0;
    let inTok = 0;
    let outTok = 0;

    for (const u of pending) {
      const all: Assoc[] = [];
      for (const window of windows) {
        const { assoc, usage } = await classifyOne(client, model, u.title, u.quote, window);
        requests += usage.requests;
        inTok += usage.input;
        outTok += usage.output;
        all.push(...assoc);
        if (all.length >= MAX_ITEMS_PER_UPDATE) break;
      }
      store.transaction(() => {
        for (const a of all.slice(0, MAX_ITEMS_PER_UPDATE)) {
          const name = (a.item_name ?? "").trim().toLowerCase();
          const id = byNameLc.get(name);
          const conf = Number(a.confidence ?? 0);
          if (id === undefined || !Number.isFinite(conf)) continue;
          insertAssociation(store, u.id, id, conf, (a.quote ?? "").slice(0, 1000));
          if (conf >= MIN_CONFIDENCE) associations++;
        }
        markClassified(store, u.id, CLASSIFIER_VERSION, now);
      });
      classified++;
    }

    if (requests > 0) recordLlmUsage(store, "news", model, requests, inTok, outTok, now);
    heartbeat(store, "news", true);
    return { polled: updates.length, classified, associations, stub: false };
  } catch (e) {
    heartbeat(store, "news", false, String(e));
    throw e;
  }
}

async function classifyOne(
  client: Anthropic,
  model: string,
  title: string,
  quote: string,
  window: { id: number; name: string }[],
): Promise<{ assoc: Assoc[]; usage: { requests: number; input: number; output: number } }> {
  const catalogList = window.map((w) => `- ${w.name}`).join("\n");
  const userMessage =
    `Update title: ${title}\n\n` +
    `Update text (verbatim from the OSRS Wiki):\n---\n${quote.slice(0, 2000)}\n---\n\n` +
    `Closed item catalog (you may only select from these):\n${catalogList}\n\n` +
    `Reply with a JSON array as instructed.`;

  try {
    const resp = await client.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });
    let text = "";
    for (const block of resp.content) if (block.type === "text") text += block.text;
    text = text.trim().replace(/^```(?:json)?\s*|\s*```$/gm, "");
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = [];
    }
    const assoc = Array.isArray(parsed) ? (parsed as Assoc[]) : [];
    return {
      assoc,
      usage: { requests: 1, input: resp.usage?.input_tokens ?? 0, output: resp.usage?.output_tokens ?? 0 },
    };
  } catch {
    // Non-fatal: skip this window, keep polling.
    return { assoc: [], usage: { requests: 0, input: 0, output: 0 } };
  }
}
