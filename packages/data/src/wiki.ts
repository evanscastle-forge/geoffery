// OSRS Wiki real-time prices API client (spec §3). The community-blessed pipeline;
// no other price source, never scrape Jagex properties. Sends a descriptive
// user-agent identifying the project + a contact, and is gentle on rate limits.

import type { Item, LatestPrice, Snapshot } from "@geoffery/core";
import { slugify } from "@geoffery/core";

const BASE = "https://prices.runescape.wiki/api/v1/osrs";

export interface MappingItem {
  id: number;
  name: string;
  examine?: string;
  members?: boolean;
  lowalch?: number;
  highalch?: number;
  limit?: number;
  value?: number;
  icon?: string;
}

async function getJson<T>(url: string, userAgent: string): Promise<T> {
  const res = await fetch(url, { headers: { "User-Agent": userAgent } });
  if (!res.ok) throw new Error(`wiki API ${res.status} for ${url}`);
  return (await res.json()) as T;
}

/** Fetch the ~4,600-item mapping. Slugs are assigned by the caller (stable). */
export async function fetchMapping(userAgent: string): Promise<MappingItem[]> {
  return getJson<MappingItem[]>(`${BASE}/mapping`, userAgent);
}

/** Convert a mapping entry to a domain Item with a freshly-minted slug if needed. */
export function mappingToItem(m: MappingItem, slug: string): Item {
  return {
    id: m.id,
    name: m.name,
    slug,
    examine: m.examine ?? null,
    members: !!m.members,
    geLimit: m.limit ?? null,
    value: m.value ?? null,
    highalch: m.highalch ?? null,
    lowalch: m.lowalch ?? null,
    icon: m.icon ?? null,
  };
}

export { slugify };

interface LatestResponse {
  data: Record<string, { high: number | null; highTime: number | null; low: number | null; lowTime: number | null }>;
}

export async function fetchLatest(userAgent: string, fetchedAt: number): Promise<LatestPrice[]> {
  const json = await getJson<LatestResponse>(`${BASE}/latest`, userAgent);
  const out: LatestPrice[] = [];
  for (const [id, d] of Object.entries(json.data)) {
    out.push({
      itemId: Number(id),
      high: d.high ?? null,
      highTs: d.highTime ?? null,
      low: d.low ?? null,
      lowTs: d.lowTime ?? null,
      fetchedAt,
    });
  }
  return out;
}

interface FiveMinResponse {
  timestamp: number;
  data: Record<
    string,
    { avgHighPrice: number | null; avgLowPrice: number | null; highPriceVolume: number | null; lowPriceVolume: number | null }
  >;
}

/** Fetch one 5m bucket. With `timestamp`, fetch that historical bucket (backfill). */
export async function fetch5m(userAgent: string, timestamp?: number): Promise<Snapshot[]> {
  const url = timestamp ? `${BASE}/5m?timestamp=${timestamp}` : `${BASE}/5m`;
  const json = await getJson<FiveMinResponse>(url, userAgent);
  const ts = json.timestamp;
  const out: Snapshot[] = [];
  for (const [id, d] of Object.entries(json.data)) {
    out.push({
      itemId: Number(id),
      ts,
      avgHigh: d.avgHighPrice ?? null,
      avgLow: d.avgLowPrice ?? null,
      highVol: d.highPriceVolume ?? null,
      lowVol: d.lowPriceVolume ?? null,
    });
  }
  return out;
}

export type Timestep = "5m" | "1h" | "6h" | "24h";

interface TimeseriesResponse {
  data: {
    timestamp: number;
    avgHighPrice: number | null;
    avgLowPrice: number | null;
    highPriceVolume: number | null;
    lowPriceVolume: number | null;
  }[];
}

/**
 * Per-item price history (up to 365 points at the chosen timestep — `6h` ≈ 91 days,
 * `24h` ≈ 365 days). Used to backfill a fresh DB that has no accumulated 5m history; the
 * coarse points are sufficient for the 30-day gauge/sparklines (only the 24h chart wants 5m,
 * which the live collector fills going forward). One item per call — be gentle with these.
 */
export async function fetchTimeseries(userAgent: string, itemId: number, timestep: Timestep = "6h"): Promise<Snapshot[]> {
  const json = await getJson<TimeseriesResponse>(`${BASE}/timeseries?timestep=${timestep}&id=${itemId}`, userAgent);
  const out: Snapshot[] = [];
  for (const d of json.data ?? []) {
    out.push({
      itemId,
      ts: d.timestamp,
      avgHigh: d.avgHighPrice ?? null,
      avgLow: d.avgLowPrice ?? null,
      highVol: d.highPriceVolume ?? null,
      lowVol: d.lowPriceVolume ?? null,
    });
  }
  return out;
}
