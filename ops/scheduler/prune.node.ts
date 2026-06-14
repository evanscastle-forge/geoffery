// Cache pruning (owner directive 2026-06-13): the store is a 30-day CACHE, not a
// permanent record — the OSRS Wiki is the source of truth. This hard-prunes both the
// queryable prices_5m table and the gzipped archive day-files to a rolling 30 days so
// the cache cannot balloon. Runs in the pipeline after collect.

import { LocalArchiveStore, loadConfig, openStore, pruneOldData } from "@geoffery/data";

const KEEP_DAYS = 30;

async function main(): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);
  try {
    const rowsDropped = await pruneOldData(store, now, KEEP_DAYS);
    const archive = new LocalArchiveStore(cfg.archiveDir);
    const daysDropped = archive.pruneDays(KEEP_DAYS);
    console.log(`prune ok: dropped ${rowsDropped} prices_5m rows, ${daysDropped} archive day-files (keep ${KEEP_DAYS}d)`);
  } finally {
    store.close();
  }
}

main().catch((e) => {
  console.error("prune failed:", e);
  process.exit(1);
});
