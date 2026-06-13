// Node entry for the aggregator cron job.

import { loadConfig, openStore } from "@geoffery/data";
import { runAggregate } from "./handler.ts";

function main(): void {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);
  try {
    const t0 = Date.now();
    const n = runAggregate(store);
    console.log(`aggregate ok: ${n} items in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } finally {
    store.close();
  }
}

main();
