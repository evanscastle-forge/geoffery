// Node entry for the news cron job. Polls the wiki + (if a key is present)
// classifies via Haiku. Without a key it degrades cleanly.
import { loadConfig, openStore } from "@geoffery/data";
import { runNews } from "./handler.ts";

async function main(): Promise<void> {
  const cfg = loadConfig();
  const store = openStore(cfg.dbPath);
  try {
    const r = await runNews(store, cfg.userAgent, cfg.anthropicApiKey, cfg.newsClassifierModel);
    if (r.stub) {
      console.log(`news ok (stub mode, no ANTHROPIC_API_KEY): polled ${r.polled} updates, no annotations`);
    } else {
      console.log(`news ok: polled ${r.polled}, classified ${r.classified}, ${r.associations} high-confidence associations`);
    }
  } finally {
    store.close();
  }
}

main().catch((e) => {
  console.error("news failed:", e);
  process.exit(1);
});
