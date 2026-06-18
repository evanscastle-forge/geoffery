// Tipping (spec §7/§8). Portable handlers for the consult worker's /api/tip and
// /api/stripe/webhook. No price math — Stripe holds the money. createTipCheckout builds a
// one-time Checkout Session for the exact amount the patron chose; recordTipFromEvent
// persists a paid tip to the donations table. The Stripe *instance* and the webhook
// signature verification live in the entry (worker.ts / main.node.ts) because the
// http + crypto clients differ by runtime (fetch + SubtleCrypto on Workers).

import type Stripe from "stripe";
import { insertDonation, type SqlStore } from "@geoffery/data";

export interface TipRequest {
  /** The tip amount in US cents (a whole-dollar box × 100). $1–$1000. */
  amountCents: number;
}

const MIN_CENTS = 100; //   $1 — a coin in the jar
const MAX_CENTS = 100_000; // $1000 — a polite ceiling; this is a tip, not a transfer

/** "YYYY-MM" in UTC — the month the jar credits the tip to. */
function monthKey(now: number): string {
  return new Date(now * 1000).toISOString().slice(0, 7);
}

/** Create a one-time Stripe Checkout Session for a tip. Returns the hosted-checkout URL. */
export async function createTipCheckout(
  stripe: Stripe,
  body: TipRequest,
  origin: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const cents = Math.round(Number(body?.amountCents));
  if (!Number.isFinite(cents) || cents < MIN_CENTS || cents > MAX_CENTS) {
    return { ok: false, error: "a tip must be between $1 and $1000" };
  }
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: cents,
          product_data: { name: "A coin in Geoffery's jar" },
        },
      },
    ],
    metadata: { purpose: "tip", month: monthKey(now) },
    success_url: `${origin}/tips/?tip=thanks&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/tips/?tip=cancelled`,
  });
  return session.url ? { ok: true, url: session.url } : { ok: false, error: "no checkout url" };
}

/** Persist a paid tip from a VERIFIED Stripe event (idempotent on the session id).
 *  Returns whether a donation was recorded — non-paid sessions and other event types
 *  are ignored so Stripe still gets its 200. */
export async function recordTipFromEvent(
  store: SqlStore,
  event: Stripe.Event,
  now: number = Math.floor(Date.now() / 1000),
): Promise<{ recorded: boolean }> {
  if (event.type !== "checkout.session.completed") return { recorded: false };
  const s = event.data.object as Stripe.Checkout.Session;
  if (s.payment_status !== "paid") return { recorded: false };
  await insertDonation(store, {
    id: s.id,
    amountCents: s.amount_total ?? 0,
    currency: s.currency ?? "usd",
    month: (s.metadata?.month as string | undefined) || monthKey(now),
    donorName: s.customer_details?.name ?? null,
    paymentIntent: typeof s.payment_intent === "string" ? s.payment_intent : null,
    createdAt: now,
  });
  return { recorded: true };
}
