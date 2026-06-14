/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the scorer cron (spec §2.6). Binds D1 and runs the
// portable runScorer handler over the async seam (see _shared/cloudflare.ts).
import { type Env, D1Store } from "../../_shared/cloudflare.ts";
import { runScorer } from "./handler.ts";

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const store = new D1Store(env.DB);
    await runScorer(store);
  },
} satisfies ExportedHandler<Env>;
