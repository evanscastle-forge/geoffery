// Phase 0 — Salvage. One-shot export of ALL raw price history from the reference
// repo's SQLite into this repo's R2 daily-file format. The reference DB is opened
// READ-ONLY and never modified (spec Phase 0 rule). This is the only irreversible
// dependency — it runs before anything else.

import { DatabaseSync } from "node:sqlite";
import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ARCHIVE_SCHEMA_VERSION,
  DayWriter,
  LocalArchiveStore,
  dayKey,
  loadConfig,
  type ArchiveManifest,
  type DayManifest,
} from "@geoffery/data";
import type { Snapshot } from "@geoffery/core";

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  if (!existsSync(cfg.legacyDbPath)) {
    console.error(`legacy DB not found at ${cfg.legacyDbPath}`);
    console.error("set GEOFFERY_LEGACY_DB in .env to the reference geoffery.db path.");
    process.exit(2);
  }

  console.log(`reading legacy DB (read-only): ${cfg.legacyDbPath}`);
  const db = new DatabaseSync(cfg.legacyDbPath, { readOnly: true });
  const archive = new LocalArchiveStore(cfg.archiveDir);

  // 1) Item dimension snapshot.
  const items = db
    .prepare(
      `SELECT id, name, slug, examine, members, ge_limit, value, highalch, lowalch, icon
       FROM items ORDER BY id`,
    )
    .all() as Record<string, unknown>[];
  archive.writeItems(items);
  console.log(`exported ${items.length} items → items.json.gz`);

  // 2) Stream prices_5m ascending by ts; roll a new day file at each UTC-day boundary.
  const total = (
    db.prepare("SELECT COUNT(*) AS n FROM prices_5m").get() as { n: number }
  ).n;
  console.log(`streaming ${total.toLocaleString()} price rows...`);

  const stmt = db.prepare(
    `SELECT item_id, ts, avg_high, avg_low, high_vol, low_vol
     FROM prices_5m ORDER BY ts, item_id`,
  );

  const days: Record<string, DayManifest> = {};
  let writer: DayWriter | null = null;
  let currentDay = "";
  let written = 0;
  const t0 = Date.now();

  for (const row of stmt.iterate() as Iterable<Record<string, number | null>>) {
    const ts = row.ts as number;
    const day = dayKey(ts);
    if (day !== currentDay) {
      if (writer) days[writer.day] = await writer.close();
      writer = new DayWriter(archive, day);
      currentDay = day;
    }
    const snap: Snapshot = {
      itemId: row.item_id as number,
      ts,
      avgHigh: row.avg_high ?? null,
      avgLow: row.avg_low ?? null,
      highVol: row.high_vol ?? null,
      lowVol: row.low_vol ?? null,
    };
    writer!.write(snap);
    written++;
    if (written % 1_000_000 === 0) {
      const rate = Math.round(written / ((Date.now() - t0) / 1000));
      console.log(`  ${written.toLocaleString()} rows (${rate.toLocaleString()}/s)`);
    }
  }
  if (writer) days[writer.day] = await writer.close();
  db.close();

  // 3) Hash each day object for the restore drill.
  let totalRows = 0;
  const dayManifest: Record<string, DayManifest & { sha256: string }> = {};
  for (const [day, m] of Object.entries(days)) {
    totalRows += m.rows;
    dayManifest[day] = { ...m, sha256: sha256File(join(archive.root, m.object)) };
  }

  const manifest: ArchiveManifest = {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    generator: "migrate-legacy",
    generatedAt: Math.floor(Date.now() / 1000),
    totalRows,
    days: dayManifest,
  };
  archive.writeManifest(manifest);

  console.log(`\ndone: ${written.toLocaleString()} rows → ${Object.keys(days).length} day files`);
  console.log(`manifest totalRows = ${totalRows.toLocaleString()} (source = ${total.toLocaleString()})`);
  if (totalRows !== total) {
    console.error("ROW COUNT MISMATCH — investigate before proceeding");
    process.exit(1);
  }
  console.log("row counts reconcile ✓  (run `npm run migrate:verify` for spot-checks)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
