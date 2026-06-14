// Build-time export (spec §2: the site reads only D1/KV or build-time exports of
// them — never external APIs at request time). Writes the JSON snapshots the Astro
// site consumes. Atomic writes (.tmp + rename) so a build never sees partial data.

import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mid } from "@geoffery/core";
import {
  allItems,
  calibrationSummary,
  loadConfig,
  openStore,
  recentWikiNotices,
  type SqliteStore,
} from "@geoffery/data";

const ONE_DAY = 86400;
const SPARK_POINTS = 48;
const OUT_DIR = join(process.cwd(), "site", "src", "generated");

interface AggRow {
  item_id: number;
  computed_at: number;
  sample_count: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  current_price: number | null;
  current_percentile: number | null;
  band: string;
  verdict_text: string;
  flags_json: string;
  volume_24h: number;
  volume_baseline: number;
  regime_power: string | null;
  regime_stability: string | null;
  liquidity_band: string | null;
  rec_instant_buy: number | null;
  rec_instant_sell: number | null;
  rec_hours_buy: number | null;
  rec_hours_sell: number | null;
  rec_patient_buy: number | null;
  rec_patient_sell: number | null;
  rec_extended_buy: number | null;
  rec_extended_sell: number | null;
  rec_fair_keys: string | null;
  engine_version: number;
}

function atomicWrite(name: string, data: unknown): void {
  const path = join(OUT_DIR, name);
  const tmp = path + ".tmp";
  writeFileSync(tmp, JSON.stringify(data));
  renameSync(tmp, path);
}

/** Time-bucket a sorted [ts, mid] series into `points` mean values over [from, to]. */
function downsample(series: [number, number][], from: number, to: number, points: number): [number, number][] {
  if (series.length === 0) return [];
  const span = Math.max(1, to - from);
  const sums = new Array(points).fill(0);
  const counts = new Array(points).fill(0);
  for (const [ts, v] of series) {
    if (ts < from || ts > to) continue;
    let b = Math.floor(((ts - from) / span) * points);
    if (b >= points) b = points - 1;
    if (b < 0) b = 0;
    sums[b] += v;
    counts[b]++;
  }
  const out: [number, number][] = [];
  for (let b = 0; b < points; b++) {
    if (counts[b] > 0) {
      const ts = from + Math.round(((b + 0.5) / points) * span);
      out.push([ts, Math.round(sums[b] / counts[b])]);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath) as SqliteStore;
  mkdirSync(OUT_DIR, { recursive: true });
  const now = Math.floor(Date.now() / 1000);
  const t0 = Date.now();

  const items = await allItems(store);
  const slugById = new Map(items.map((i) => [i.id, i.slug]));
  const nameById = new Map(items.map((i) => [i.id, i.name]));

  // 1) search index
  atomicWrite(
    "items.json",
    items.map((i) => ({ id: i.id, slug: i.slug, name: i.name, members: i.members, icon: i.icon })),
  );

  // 2) aggregates keyed by slug (+ recent wiki notices from the news layer)
  const notices = await recentWikiNotices(store, now);
  const aggregates: Record<string, unknown> = {};
  for (const r of await store.all<AggRow>("SELECT * FROM aggregates")) {
    const slug = slugById.get(r.item_id);
    if (!slug) continue;
    aggregates[slug] = {
      slug,
      name: nameById.get(r.item_id) ?? slug,
      band: r.band,
      verdictText: r.verdict_text,
      percentile: r.current_percentile,
      p25: r.p25,
      p50: r.p50,
      p75: r.p75,
      currentPrice: r.current_price,
      flags: JSON.parse(r.flags_json) as string[],
      sampleCount: r.sample_count,
      volume24h: r.volume_24h,
      volumeBaseline: r.volume_baseline,
      computedAt: r.computed_at,
      regimePower: r.regime_power,
      regimeStability: r.regime_stability,
      liquidityBand: r.liquidity_band,
      rec: {
        instantBuy: r.rec_instant_buy,
        instantSell: r.rec_instant_sell,
        hoursBuy: r.rec_hours_buy,
        hoursSell: r.rec_hours_sell,
        patientBuy: r.rec_patient_buy,
        patientSell: r.rec_patient_sell,
        extendedBuy: r.rec_extended_buy,
        extendedSell: r.rec_extended_sell,
      },
      recFairKeys: JSON.parse(r.rec_fair_keys ?? "[]") as string[],
      wikiNotices: notices.get(r.item_id) ?? [],
    };
  }
  atomicWrite("aggregates.json", aggregates);

  // 3) sparklines: one sequential scan of the trailing 30 days, per item.
  const sparklines: Record<string, { d1: [number, number][]; w1: [number, number][]; m1: [number, number][] }> = {};
  const cutoff = now - 30 * ONE_DAY;
  let buf: [number, number][] = [];
  let curItem = -1;
  const flush = (itemId: number, series: [number, number][]) => {
    const slug = slugById.get(itemId);
    if (!slug || series.length === 0) return;
    sparklines[slug] = {
      d1: downsample(series, now - ONE_DAY, now, SPARK_POINTS),
      w1: downsample(series, now - 7 * ONE_DAY, now, SPARK_POINTS),
      m1: downsample(series, cutoff, now, SPARK_POINTS),
    };
  };
  for (const row of store.iterate<{ item_id: number; ts: number; avg_high: number | null; avg_low: number | null }>(
    "SELECT item_id, ts, avg_high, avg_low FROM prices_5m WHERE ts >= ? ORDER BY item_id, ts",
    cutoff,
  )) {
    if (row.item_id !== curItem) {
      if (curItem !== -1) flush(curItem, buf);
      curItem = row.item_id;
      buf = [];
    }
    const m = mid(row.avg_high, row.avg_low);
    if (m !== null) buf.push([row.ts, m]);
  }
  if (curItem !== -1) flush(curItem, buf);
  atomicWrite("sparklines.json", sparklines);

  // 4) methodology stats (calibration) + 5) news + 6) meta
  atomicWrite("methodology-stats.json", await calibrationSummary(store, now));
  atomicWrite("news.json", await recentWikiList(store, now));
  atomicWrite("meta.json", { exportedAt: now, deployment: cfg.deployment });

  console.log(
    `export ok: ${items.length} items, ${Object.keys(aggregates).length} aggregates, ` +
      `${Object.keys(sparklines).length} sparklines in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  store.close();
}

async function recentWikiList(store: SqliteStore, now: number): Promise<unknown[]> {
  return store.all(
    `SELECT id, title, summary, kind, COALESCE(published_at, discovered_at) AS at, wiki_url
     FROM wiki_updates WHERE COALESCE(published_at, discovered_at) >= ? ORDER BY at DESC LIMIT 30`,
    now - 30 * ONE_DAY,
  );
}

main().catch((e) => {
  console.error("export failed:", e);
  process.exit(1);
});
