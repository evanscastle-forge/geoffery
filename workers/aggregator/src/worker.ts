/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the aggregator cron (spec §2.5). Binds D1 and runs the
// portable runAggregate handler. See workers/_shared/cloudflare.ts (async seam).
import { type Env, D1Store, seamNotWired } from "../../_shared/cloudflare.ts";
// import { runAggregate } from "./handler.ts"; // wire after the async seam conversion

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const store = new D1Store(env.DB);
    void store;
    // Post-conversion:  await runAggregate(store);
    seamNotWired("aggregator");
  },
} satisfies ExportedHandler<Env>;
