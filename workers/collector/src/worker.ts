/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the collector cron (spec §3). Binds D1 + R2 and runs the
// portable runCollect handler. The storage seam is async (D1Store/R2Archive
// satisfy it natively) — see workers/_shared/cloudflare.ts.
import { type Env, D1Store, R2Archive } from "../../_shared/cloudflare.ts";
import { runCollect } from "./handler.ts";

export default {
  async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    if (!env.ARCHIVE) throw new Error("[collector] missing R2 ARCHIVE binding");
    const store = new D1Store(env.DB);
    const archive = new R2Archive(env.ARCHIVE);
    await runCollect(store, archive, env.GEOFFERY_USER_AGENT ?? "Geoffery (contact)");
  },
} satisfies ExportedHandler<Env>;
