// Node entry for the scorer cron job.
import { loadConfig, openStore } from "@geoffery/data";
import { runScorer } from "./handler.ts";

function main(): void {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);
  try {
    const s = runScorer(store);
    console.log(
      `scorer ok: considered=${s.considered} evaluated=${s.evaluated} filled=${s.filled} not_closed=${s.windowNotClosed}`,
    );
  } finally {
    store.close();
  }
}

main();
