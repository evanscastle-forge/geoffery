// One-time history backfill via the OSRS Wiki per-item timeseries endpoint. A freshly
// provisioned D1 has only the items it has collected since launch — no 30-day history — so the
// gauge/sparklines come out empty. This fetches each item's 6h timeseries (~91 days; trimmed to
// the trailing window) and emits a SQL file of `INSERT ... ON CONFLICT(prices_5m)` statements to
// apply with `wrangler d1 import`. Coarse 6h points are enough for the 30-day gauge, percentiles,
// sparklines and change30d; only the 24h chart wants 5m, which the live collector fills going
// forward. Idempotent (upsert on (item_id, ts)); the live 5m data supersedes it over ~30 days.
//
// Driven by `ops/run.sh <env> backfill-history`. Env knobs: GEOFFERY_BACKFILL_OUT (file),
// GEOFFERY_BACKFILL_TIMESTEP (6h), GEOFFERY_BACKFILL_DAYS (33), GEOFFERY_BACKFILL_CONCURRENCY (5).

import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fetchMapping, fetchTimeseries, loadConfig, type Timestep } from "@geoffery/data/node";

const OUT = process.env.GEOFFERY_BACKFILL_OUT ?? "./.data/backfill.sql";
const TIMESTEP = (process.env.GEOFFERY_BACKFILL_TIMESTEP ?? "6h") as Timestep;
const DAYS = Number(process.env.GEOFFERY_BACKFILL_DAYS ?? "33");
const CONCURRENCY = Math.max(1, Number(process.env.GEOFFERY_BACKFILL_CONCURRENCY ?? "5"));

const num = (n: number | null): string => (n === null || !Number.isFinite(n) ? "NULL" : String(Math.trunc(n)));

async function main(): Promise<void> {
  const { userAgent } = loadConfig();
  const cutoff = Math.floor(Date.now() / 1000) - DAYS * 86400;
  const items = await fetchMapping(userAgent);
  mkdirSync(dirname(OUT), { recursive: true });
  const stream = createWriteStream(OUT);

  let rows = 0;
  let done = 0;
  const t0 = Date.now();
  let next = 0;

  async function worker(): Promise<void> {
    while (next < items.length) {
      const id = items[next++]!.id;
      try {
        for (const s of await fetchTimeseries(userAgent, id, TIMESTEP)) {
          if (s.ts < cutoff) continue;
          stream.write(
            `INSERT INTO prices_5m (item_id, ts, avg_high, avg_low, high_vol, low_vol) VALUES ` +
              `(${id},${s.ts},${num(s.avgHigh)},${num(s.avgLow)},${num(s.highVol)},${num(s.lowVol)}) ` +
              `ON CONFLICT(item_id, ts) DO UPDATE SET avg_high=excluded.avg_high, avg_low=excluded.avg_low, ` +
              `high_vol=excluded.high_vol, low_vol=excluded.low_vol;\n`,
          );
          rows++;
        }
      } catch (e) {
        console.error(`  item ${id} failed: ${(e as Error).message}`);
      }
      if (++done % 250 === 0) {
        const rate = Math.round(done / ((Date.now() - t0) / 1000));
        console.log(`  ${done}/${items.length} items · ${rows.toLocaleString()} rows · ${rate}/s`);
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));
  await new Promise<void>((resolve) => stream.end(resolve));
  console.log(`backfill: ${rows.toLocaleString()} rows for ${items.length} items → ${OUT} (timestep=${TIMESTEP}, ${DAYS}d)`);
}

main().catch((e) => {
  console.error("backfill-timeseries failed:", e);
  process.exit(1);
});
