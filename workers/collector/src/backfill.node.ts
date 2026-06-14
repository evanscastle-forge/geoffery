// Backfill: load the migrated R2 archive into the local SqlStore (D1 stand-in)
// through the SAME ArchiveStore reader the aggregator uses. One-time bootstrap so
// the aggregator has 30 days of history to compute distributions from.
//
// Localhost note (DECISIONS D-LOCAL-005): on Cloudflare, D1 would hold only a
// rolling hot window with incrementally-maintained aggregates. Locally there is
// no Worker CPU limit, so we load the full migrated history into SQLite and let
// the aggregator query per-item — far simpler and robust for the demo. The R2
// archive remains the source-of-truth backup.

import {
  LocalArchiveStore,
  insertSnapshots,
  itemFromRow,
  loadConfig,
  openStore,
  snapshotCount,
  upsertItemStatement,
  type ItemRow,
} from "@geoffery/data";

const ITEM_BATCH = 500;

async function main(): Promise<void> {
  const cfg = loadConfig();
  const archive = new LocalArchiveStore(cfg.archiveDir);
  const store = openStore(cfg.dbPath);
  const now = Math.floor(Date.now() / 1000);

  // 1) Items (slugs already minted at migration time — immutable URLs).
  const items = archive.readItems<ItemRow>();
  const itemStmts = items.map((row) => upsertItemStatement(itemFromRow(row), now));
  for (let i = 0; i < itemStmts.length; i += ITEM_BATCH) {
    await store.batch(itemStmts.slice(i, i + ITEM_BATCH));
  }
  console.log(`backfilled ${items.length} items`);

  // 2) Price history, day by day.
  const days = archive.listDays();
  let total = 0;
  const t0 = Date.now();
  for (const day of days) {
    const snaps = archive.readDay(day);
    const n = insertSnapshots(store, snaps);
    total += n;
    const rate = Math.round(total / ((Date.now() - t0) / 1000));
    console.log(`  ${day}: ${n.toLocaleString()} rows  (running ${total.toLocaleString()}, ${rate.toLocaleString()}/s)`);
  }

  console.log(`\nbackfill done: ${total.toLocaleString()} rows across ${days.length} days`);
  console.log(`prices_5m now holds ${(await snapshotCount(store)).toLocaleString()} rows`);
  store.close();
}

main().catch((e) => {
  console.error("backfill failed:", e);
  process.exit(1);
});
