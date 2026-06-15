// Node entry for the scorer cron job.
import { loadConfig, openStore } from "@geoffery/data/node";
import { runScorer } from "./handler.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);
  try {
    const s = await runScorer(store);
    console.log(
      `scorer ok: considered=${s.considered} evaluated=${s.evaluated} filled=${s.filled} not_closed=${s.windowNotClosed}`,
    );
  } finally {
    store.close();
  }
}

main().catch((e) => {
  console.error("scorer failed:", e);
  process.exit(1);
});
