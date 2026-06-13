/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the news cron (spec §2.7/§6). Binds D1; ANTHROPIC_API_KEY
// arrives as a secret (optional → degrades). See workers/_shared/cloudflare.ts.
import { type Env, D1Store, seamNotWired } from "../../_shared/cloudflare.ts";
// import { runNews } from "./handler.ts"; // wire after the async seam conversion

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const store = new D1Store(env.DB);
    void store;
    // Post-conversion:
    //   await runNews(store, env.GEOFFERY_USER_AGENT ?? "Geoffery (contact)",
    //                 env.ANTHROPIC_API_KEY,
    //                 env.GEOFFERY_NEWS_CLASSIFIER_MODEL ?? "claude-haiku-4-5-20251001");
    seamNotWired("news");
  },
} satisfies ExportedHandler<Env>;
