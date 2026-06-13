// Node entry for the collector cron job. Wires local adapters + config and runs
// the portable handler once. (A Cloudflare scheduled() entry would wire bindings.)

import { LocalArchiveStore, loadConfig, openStore } from "@geoffery/data";
import { runCollect } from "./handler.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);
  const archive = new LocalArchiveStore(cfg.archiveDir);
  try {
    const r = await runCollect(store, archive, cfg.userAgent);
    console.log(
      `collect ok: mapping_refreshed=${r.mappingRefreshed} latest=${r.latestRows} ` +
        `5m_rows=${r.snapshotRows} bucket_ts=${r.bucketTs}`,
    );
  } finally {
    store.close();
  }
}

main().catch((e) => {
  console.error("collect failed:", e);
  process.exit(1);
});
