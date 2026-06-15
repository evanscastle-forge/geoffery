// Node entry for the consult worker: a small Hono HTTP server. The Astro dev
// server proxies /api/* here. On Cloudflare this becomes a Pages Function /
// Worker fetch() handler binding D1 — same handler body, different entry.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import Stripe from "stripe";
import { loadConfig, openStore } from "@geoffery/data/node";
import { logConsultation, type ConsultRequest } from "./handler.ts";
import { createTipCheckout, recordTipFromEvent, type TipRequest } from "./tip.ts";

const cfg = loadConfig();
const store = openStore(cfg.dbPath);
const app = new Hono();

// Tipping (test mode locally). Without STRIPE_SECRET_KEY, /api/tip returns "not configured".
const stripeKey = process.env.STRIPE_SECRET_KEY;
const stripe = stripeKey ? new Stripe(stripeKey) : null;
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
const siteUrl = process.env.GEOFFERY_SITE_URL ?? "http://127.0.0.1:4321";

const CLIENT_COOKIE = "geoffery_cid";

function clientIdFrom(cookie: string | undefined): string {
  const m = cookie?.match(/geoffery_cid=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : crypto.randomUUID();
}

app.get("/api/health", (c) => c.json({ ok: true, deployment: cfg.deployment }));

app.post("/api/consult", async (c) => {
  let body: ConsultRequest;
  try {
    body = (await c.req.json()) as ConsultRequest;
  } catch {
    return c.json({ ok: false, error: "bad json" }, 400);
  }
  const cid = clientIdFrom(c.req.header("cookie"));
  const result = await logConsultation(store, body, cid);
  if (result.ok) {
    c.header(
      "set-cookie",
      `${CLIENT_COOKIE}=${encodeURIComponent(cid)}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    return c.json(result, 201);
  }
  return c.json(result, 400);
});

app.post("/api/tip", async (c) => {
  if (!stripe) return c.json({ ok: false, error: "tipping not configured" }, 503);
  let body: TipRequest;
  try {
    body = (await c.req.json()) as TipRequest;
  } catch {
    return c.json({ ok: false, error: "bad json" }, 400);
  }
  const result = await createTipCheckout(stripe, body, siteUrl);
  return result.ok ? c.json(result, 200) : c.json(result, 400);
});

app.post("/api/stripe/webhook", async (c) => {
  if (!stripe || !stripeWebhookSecret) return c.text("not configured", 503);
  const sig = c.req.header("stripe-signature");
  if (!sig) return c.text("missing signature", 400);
  const raw = await c.req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(raw, sig, stripeWebhookSecret);
  } catch (err) {
    return c.text(`bad signature: ${String(err)}`, 400);
  }
  await recordTipFromEvent(store, event);
  return c.json({ received: true });
});

const port = cfg.consultPort;
serve({ fetch: app.fetch, port }, () => {
  console.log(`consult worker listening on http://127.0.0.1:${port}`);
});
