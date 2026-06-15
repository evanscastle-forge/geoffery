// Backtest cold-start (spec §5): run the PRODUCTION engine (@geoffery/core) over
// the migrated history to produce initial calibration + a launch track record
// ("had Geoffery been advising these past N days…"). No reimplementation of the
// engine — the same pure functions the live workers use.
//
// Method: at a set of decision times T, for a stratified sample of items, compute
// the recommendations Geoffery WOULD have made from the trailing window, then score
// each against what the market actually did in the tolerance window after T.

import {
  WINDOWS,
  classify,
  fillRateByCohort,
  liquidityBand,
  mid,
  recommendAll,
  filledWithinWindow,
  THIRTY_DAYS,
} from "@geoffery/core";
import type { Side, Snapshot, Tolerance } from "@geoffery/core";
import {
  loadConfig,
  openStore,
  replaceCalibration,
  snapshotsForItem,
  type SqliteStore,
} from "@geoffery/data/node";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const ONE_DAY = 86400;
const SAMPLE_PER_BAND = 120; // items per liquidity band
const DECISION_COUNT = 12; // decision times across the usable window

async function stratifiedItems(store: SqliteStore): Promise<number[]> {
  // Use the already-computed aggregates to stratify by liquidity band.
  const pick = async (band: string) =>
    (
      await store.all<{ item_id: number }>(
        "SELECT item_id FROM aggregates WHERE liquidity_band = ? AND sample_count >= 200 ORDER BY volume_baseline DESC LIMIT ?",
        band,
        SAMPLE_PER_BAND,
      )
    ).map((r) => r.item_id);
  return [...(await pick("thick")), ...(await pick("medium")), ...(await pick("thin"))];
}

function instaAt(rows: Snapshot[], t: number): { buy: number | null; sell: number | null } {
  // Nearest bucket at or before T → its avg_high/avg_low proxy the insta prices.
  let best: Snapshot | null = null;
  for (const r of rows) {
    if (r.ts <= t && (best === null || r.ts > best.ts)) best = r;
  }
  if (!best) return { buy: null, sell: null };
  return { buy: best.avgHigh ?? best.avgLow, sell: best.avgLow ?? best.avgHigh };
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);

  const span = await store.get<{ lo: number; hi: number }>("SELECT MIN(ts) AS lo, MAX(ts) AS hi FROM prices_5m");
  if (!span) {
    console.error("no price history");
    process.exit(1);
  }
  const { lo, hi } = span;

  // Decision times: leave 72h after the last for the patient window; start a few
  // days in so there is some trailing history.
  const usableStart = lo + 3 * ONE_DAY;
  const usableEnd = hi - 3 * ONE_DAY;
  const step = (usableEnd - usableStart) / (DECISION_COUNT - 1);
  const decisionTimes = Array.from({ length: DECISION_COUNT }, (_, i) => Math.round(usableStart + i * step));

  const items = await stratifiedItems(store);
  console.log(`backtest: ${items.length} items × ${decisionTimes.length} decision times`);

  const pairs: { confidenceBucket: string; filled: boolean }[] = [];
  let predictions = 0;
  const t0 = Date.now();

  for (const itemId of items) {
    // Load the item's full history once; slice per decision time in memory.
    const all = await snapshotsForItem(store, itemId, lo);
    for (const T of decisionTimes) {
      const trailing = all.filter((s) => s.ts >= T - THIRTY_DAYS && s.ts <= T);
      if (trailing.length < 30) continue;
      const regime = classify(trailing, T);
      if (!regime) continue;

      let volTotal = 0;
      const mids: number[] = [];
      for (const s of trailing) {
        const m = mid(s.avgHigh, s.avgLow);
        if (m !== null) mids.push(m);
        volTotal += (s.highVol ?? 0) + (s.lowVol ?? 0);
      }
      const liquidity = liquidityBand(Math.trunc(volTotal / 30));
      const insta = instaAt(all, T);
      // Backtest validates the price-only model (no historical sentiment replay).
      const recs = recommendAll(insta.buy, insta.sell, mids, null);
      const lastTs = all.length ? all[all.length - 1]!.ts : T;

      for (const tolerance of ["instant", "hours", "patient", "extended"] as Tolerance[]) {
        for (const side of ["buy", "sell"] as Side[]) {
          const price = recs.prices[`${tolerance}_${side}`];
          if (price == null) continue;
          const [startOff, endOff] = WINDOWS[tolerance];
          if (T + endOff > lastTs) continue; // window hasn't closed within the cache — don't score
          const windowSnaps = all.filter((s) => s.ts >= T + startOff && s.ts < T + endOff);
          const [filled] = filledWithinWindow(windowSnaps, side, price, T + startOff, T + endOff);
          pairs.push({ confidenceBucket: `${tolerance}/${side}/${liquidity}/${regime.stability}`, filled });
          predictions++;
        }
      }
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const cohorts = fillRateByCohort(pairs);
  await replaceCalibration(store, cohorts, now);

  // Track record summary.
  const overall = pairs.reduce((a, p) => ({ n: a.n + 1, f: a.f + (p.filled ? 1 : 0) }), { n: 0, f: 0 });
  const byTol: Record<string, { n: number; f: number }> = {};
  for (const p of pairs) {
    const tol = p.confidenceBucket.split("/")[0]!;
    const t = (byTol[tol] ??= { n: 0, f: 0 });
    t.n++;
    if (p.filled) t.f++;
  }

  const report = {
    generatedAt: now,
    historyDays: Math.round((hi - lo) / ONE_DAY),
    items: items.length,
    decisionTimes: decisionTimes.length,
    predictions,
    overallFillRate: overall.n ? overall.f / overall.n : 0,
    byTolerance: Object.fromEntries(
      Object.entries(byTol).map(([k, v]) => [k, { n: v.n, fillRate: v.n ? v.f / v.n : 0 }]),
    ),
    cohorts: cohorts.length,
  };
  writeFileSync(join(process.cwd(), ".data", "backtest-report.json"), JSON.stringify(report, null, 2));

  console.log(`\nbacktest done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  console.log(`  predictions: ${predictions.toLocaleString()}`);
  console.log(`  overall fill rate: ${(report.overallFillRate * 100).toFixed(1)}%`);
  for (const [tol, v] of Object.entries(report.byTolerance)) {
    console.log(`  ${tol.padEnd(8)} ${(v.fillRate * 100).toFixed(1)}%  (n=${v.n.toLocaleString()})`);
  }
  console.log(`  wrote ${cohorts.length} calibration cohorts; report → .data/backtest-report.json`);
  store.close();
}

main().catch((e) => {
  console.error("backtest failed:", e);
  process.exit(1);
});
