/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the consult worker (spec §2.8). HTTP, not cron: it serves
// POST /api/consult + GET /api/health, routed at the zone (ops/wrangler/consult.toml)
// so the static site's same-origin /api/* reaches it. Binds D1 and runs the
// portable logConsultation handler. See workers/_shared/cloudflare.ts (async seam).
import { type Env, D1Store, seamNotWired } from "../../_shared/cloudflare.ts";
// import { logConsultation, type ConsultRequest } from "./handler.ts"; // wire post-conversion

const CLIENT_COOKIE = "geoffery_cid";

function clientIdFrom(cookie: string | null): string {
  const m = cookie?.match(/geoffery_cid=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : crypto.randomUUID();
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const store = new D1Store(env.DB);
    void store;
    void clientIdFrom; // used post-conversion to set the geoffery_cid cookie
    void CLIENT_COOKIE;

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, deployment: env.GEOFFERY_DEPLOYMENT_NAME ?? "unknown" });
    }
    if (url.pathname === "/api/consult" && req.method === "POST") {
      // Post-conversion:
      //   const body = (await req.json()) as ConsultRequest;
      //   const cid = clientIdFrom(req.headers.get("cookie"));
      //   const result = await logConsultation(store, body, cid);
      //   return Response.json(result, { status: result.ok ? 201 : 400,
      //     headers: result.ok ? { "set-cookie": `${CLIENT_COOKIE}=${encodeURIComponent(cid)};
      //       Path=/; Max-Age=31536000; SameSite=Lax` } : {} });
      seamNotWired("consult");
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
