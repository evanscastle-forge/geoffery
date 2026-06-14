/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the aggregator cron (spec §2.5). Binds D1 and runs the
// portable runAggregate handler over the async seam (see _shared/cloudflare.ts).
import { type Env, D1Store } from "../../_shared/cloudflare.ts";
import { runAggregate } from "./handler.ts";

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const store = new D1Store(env.DB);
    await runAggregate(store);
  },
} satisfies ExportedHandler<Env>;
