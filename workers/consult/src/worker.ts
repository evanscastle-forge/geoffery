/// <reference types="@cloudflare/workers-types" />
// Cloudflare entry for the consult worker (spec §2.8). HTTP, not cron: it serves
// POST /api/consult, POST /api/tip, POST /api/stripe/webhook, and GET /api/health, routed
// at the zone (ops/wrangler/consult.toml) so the static site's same-origin /api/* reaches
// it. Binds D1 and runs the portable handlers over the async seam (_shared/cloudflare.ts).
import Stripe from "stripe";
import { type Env, D1Store } from "../../_shared/cloudflare.ts";
import { logConsultation, type ConsultRequest } from "./handler.ts";
import { createTipCheckout, recordTipFromEvent, type TipRequest } from "./tip.ts";

const CLIENT_COOKIE = "geoffery_cid";

function clientIdFrom(cookie: string | null): string {
  const m = cookie?.match(/geoffery_cid=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : crypto.randomUUID();
}

/** Stripe client for the Workers runtime (fetch http client). */
function stripeClient(key: string): Stripe {
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const store = new D1Store(env.DB);

    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, deployment: env.GEOFFERY_DEPLOYMENT_NAME ?? "unknown" });
    }

    if (url.pathname === "/api/consult" && req.method === "POST") {
      let body: ConsultRequest;
      try {
        body = (await req.json()) as ConsultRequest;
      } catch {
        return Response.json({ ok: false, error: "bad json" }, { status: 400 });
      }
      const cid = clientIdFrom(req.headers.get("cookie"));
      const result = await logConsultation(store, body, cid);
      return Response.json(result, {
        status: result.ok ? 201 : 400,
        headers: result.ok
          ? { "set-cookie": `${CLIENT_COOKIE}=${encodeURIComponent(cid)}; Path=/; Max-Age=31536000; SameSite=Lax` }
          : {},
      });
    }

    // A tip → a Stripe Checkout Session for the exact amount; the site redirects to the url.
    if (url.pathname === "/api/tip" && req.method === "POST") {
      if (!env.STRIPE_SECRET_KEY) {
        return Response.json({ ok: false, error: "tipping not configured" }, { status: 503 });
      }
      let body: TipRequest;
      try {
        body = (await req.json()) as TipRequest;
      } catch {
        return Response.json({ ok: false, error: "bad json" }, { status: 400 });
      }
      const origin = env.GEOFFERY_SITE_URL ?? url.origin;
      const result = await createTipCheckout(stripeClient(env.STRIPE_SECRET_KEY), body, origin);
      return Response.json(result, { status: result.ok ? 200 : 400 });
    }

    // Stripe → us (server-to-server). This exact path is behind Cloudflare Access, so it
    // needs an Access *Bypass* policy (docs/CLOUDFLARE-SETUP.md); the Stripe signature is
    // the real auth. Verify against the RAW body before doing anything with it.
    if (url.pathname === "/api/stripe/webhook" && req.method === "POST") {
      if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
        return new Response("not configured", { status: 503 });
      }
      const sig = req.headers.get("stripe-signature");
      if (!sig) return new Response("missing signature", { status: 400 });
      const raw = await req.text();
      let event: Stripe.Event;
      try {
        event = await stripeClient(env.STRIPE_SECRET_KEY).webhooks.constructEventAsync(
          raw,
          sig,
          env.STRIPE_WEBHOOK_SECRET,
          undefined,
          Stripe.createSubtleCryptoProvider(),
        );
      } catch (err) {
        return new Response(`bad signature: ${String(err)}`, { status: 400 });
      }
      await recordTipFromEvent(store, event);
      return Response.json({ received: true });
    }

    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
