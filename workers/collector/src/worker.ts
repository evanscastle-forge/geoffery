/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the collector cron (spec §3). Binds D1 + R2 and runs the
// portable runCollect handler. See workers/_shared/cloudflare.ts for the async
// seam status — until that conversion lands this fails loudly via seamNotWired.
import { type Env, D1Store, R2Archive, seamNotWired } from "../../_shared/cloudflare.ts";
// import { runCollect } from "./handler.ts"; // wire after the async seam conversion

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    const store = new D1Store(env.DB);
    const archive = env.ARCHIVE ? new R2Archive(env.ARCHIVE) : undefined;
    void store;
    void archive;
    // Post-conversion:
    //   await runCollect(store, archive!, env.GEOFFERY_USER_AGENT ?? "Geoffery (contact)");
    seamNotWired("collector");
  },
} satisfies ExportedHandler<Env>;
