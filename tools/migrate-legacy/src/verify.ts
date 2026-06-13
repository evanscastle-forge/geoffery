// Phase 0 verification (GATE 0). Reconciles the migrated archive against the
// read-only reference DB: total + per-day row counts, value spot-checks across
// items of differing liquidity, sha256 integrity, and ts boundaries. Reads the
// archive through the SAME ArchiveStore the aggregator/backtest use.

import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LocalArchiveStore, dayKey, loadConfig } from "@geoffery/data";

let failures = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

function main(): void {
  const cfg = loadConfig();
  const db = new DatabaseSync(cfg.legacyDbPath, { readOnly: true });
  const archive = new LocalArchiveStore(cfg.archiveDir);
  const manifest = archive.readManifest();
  if (!manifest) {
    console.error("no manifest — run `npm run migrate:legacy` first");
    process.exit(2);
  }

  // 1) Total row count.
  const srcTotal = (db.prepare("SELECT COUNT(*) AS n FROM prices_5m").get() as { n: number }).n;
  check("total row count reconciles", manifest.totalRows === srcTotal, `${manifest.totalRows} vs ${srcTotal}`);

  // 2) Per-day row counts (source grouped by UTC day vs manifest).
  const srcDays = new Map<string, number>();
  for (const r of db
    .prepare("SELECT ts, COUNT(*) AS n FROM prices_5m GROUP BY ts/86400")
    .all() as { ts: number; n: number }[]) {
    const day = dayKey(r.ts);
    srcDays.set(day, (srcDays.get(day) ?? 0) + r.n);
  }
  let perDayOk = srcDays.size === Object.keys(manifest.days).length;
  for (const [day, n] of srcDays) {
    if (manifest.days[day]?.rows !== n) perDayOk = false;
  }
  check("per-day row counts match", perDayOk, `${srcDays.size} days`);

  // 3) 31 non-empty day objects.
  const days = archive.listDays();
  check("31 day objects present", days.length === 31, `${days.length}`);
  check("no empty day objects", Object.values(manifest.days).every((d) => d.rows > 0));

  // 4) ts boundaries.
  const bounds = db.prepare("SELECT MIN(ts) AS lo, MAX(ts) AS hi FROM prices_5m").get() as {
    lo: number;
    hi: number;
  };
  const manifestLo = Math.min(...Object.values(manifest.days).map((d) => d.minTs));
  const manifestHi = Math.max(...Object.values(manifest.days).map((d) => d.maxTs));
  check("min ts matches", manifestLo === bounds.lo, `${manifestLo} vs ${bounds.lo}`);
  check("max ts matches", manifestHi === bounds.hi, `${manifestHi} vs ${bounds.hi}`);

  // 5) sha256 integrity of every day object.
  let shaOk = true;
  for (const [day, m] of Object.entries(manifest.days)) {
    const actual = createHash("sha256").update(readFileSync(join(archive.root, m.object))).digest("hex");
    if (actual !== m.sha256) {
      shaOk = false;
      console.log(`   sha mismatch ${day}`);
    }
  }
  check("sha256 integrity (restore-drill ready)", shaOk);

  // 6) Value spot-checks: 3 items of differing liquidity × 3 timestamps, byte-equal.
  const liqItems = pickItemsByLiquidity(db);
  let spotOk = true;
  let spotCount = 0;
  for (const itemId of liqItems) {
    const srcRows = db
      .prepare(
        `SELECT ts, avg_high, avg_low, high_vol, low_vol FROM prices_5m
         WHERE item_id = ? ORDER BY ts LIMIT 1`,
      )
      .all(itemId) as Record<string, number | null>[];
    // sample first, middle, last for this item
    const allTs = db
      .prepare("SELECT ts FROM prices_5m WHERE item_id = ? ORDER BY ts")
      .all(itemId) as { ts: number }[];
    if (allTs.length === 0) continue;
    const sampleTs = [allTs[0]!.ts, allTs[Math.floor(allTs.length / 2)]!.ts, allTs.at(-1)!.ts];
    void srcRows;
    for (const ts of sampleTs) {
      const src = db
        .prepare(
          `SELECT avg_high, avg_low, high_vol, low_vol FROM prices_5m WHERE item_id = ? AND ts = ?`,
        )
        .get(itemId, ts) as Record<string, number | null>;
      const day = archive.readDay(dayKey(ts));
      const got = day.find((s) => s.itemId === itemId && s.ts === ts);
      spotCount++;
      const match =
        got != null &&
        (got.avgHigh ?? null) === (src.avg_high ?? null) &&
        (got.avgLow ?? null) === (src.avg_low ?? null) &&
        (got.highVol ?? null) === (src.high_vol ?? null) &&
        (got.lowVol ?? null) === (src.low_vol ?? null);
      if (!match) {
        spotOk = false;
        console.log(`   spot mismatch item ${itemId} ts ${ts}: src=${JSON.stringify(src)} got=${JSON.stringify(got)}`);
      }
    }
  }
  check(`value spot-checks (${spotCount} cells across liquidity bands)`, spotOk);

  db.close();
  console.log(failures === 0 ? "\nGATE 0 PASS" : `\nGATE 0 FAIL — ${failures} check(s) failed`);
  process.exit(failures === 0 ? 0 : 1);
}

/** Pick a thick, a medium, and a thin item by total volume in prices_5m. */
function pickItemsByLiquidity(db: DatabaseSync): number[] {
  const rows = db
    .prepare(
      `SELECT item_id, SUM(COALESCE(high_vol,0)+COALESCE(low_vol,0)) AS vol
       FROM prices_5m GROUP BY item_id HAVING vol > 0 ORDER BY vol DESC`,
    )
    .all() as { item_id: number; vol: number }[];
  if (rows.length === 0) return [];
  return [rows[0]!.item_id, rows[Math.floor(rows.length / 2)]!.item_id, rows.at(-1)!.item_id];
}

main();
