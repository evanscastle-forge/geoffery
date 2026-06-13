// Consult handler (spec §5): logs each consultation as a falsifiable prediction.
// Portable core — takes the store + the request body + a client id, returns the
// stored consultation id. No price math here: the price was already computed by
// @geoffery/core at export time and shown to the user; we log exactly that.

import { ENGINE_VERSION } from "@geoffery/core";
import type { Consultation } from "@geoffery/core";
import { insertConsultation, itemBySlug, type SqlStore } from "@geoffery/data";

export interface ConsultRequest {
  slug: string;
  side: "buy" | "sell";
  tolerance: "instant" | "hours" | "patient";
  recommendedPrice: number;
  regimePower: "buyer" | "seller" | "balanced" | null;
  regimeStability: "steady" | "volatile" | null;
  liquidityBand: "thick" | "medium" | "thin" | null;
}

const VALID_SIDE = new Set(["buy", "sell"]);
const VALID_TOL = new Set(["instant", "hours", "patient"]);

export function logConsultation(
  store: SqlStore,
  body: ConsultRequest,
  clientId: string,
  now: number = Math.floor(Date.now() / 1000),
): { ok: boolean; id?: string; error?: string } {
  if (!body || typeof body.slug !== "string") return { ok: false, error: "missing slug" };
  if (!VALID_SIDE.has(body.side)) return { ok: false, error: "bad side" };
  if (!VALID_TOL.has(body.tolerance)) return { ok: false, error: "bad tolerance" };
  if (!Number.isFinite(body.recommendedPrice) || body.recommendedPrice <= 0)
    return { ok: false, error: "bad price" };

  const item = itemBySlug(store, body.slug);
  if (!item) return { ok: false, error: "unknown item" };

  const liquidity = body.liquidityBand ?? "medium";
  const stability = body.regimeStability ?? "steady";
  const consultation: Consultation = {
    id: crypto.randomUUID(),
    clientId,
    itemId: item.id,
    side: body.side,
    tolerance: body.tolerance,
    recommendedPrice: Math.round(body.recommendedPrice),
    regimePower: body.regimePower,
    regimeStability: body.regimeStability,
    liquidityBand: body.liquidityBand,
    confidenceBucket: `${body.tolerance}/${body.side}/${liquidity}/${stability}`,
    engineVersion: ENGINE_VERSION,
    createdAt: now,
  };
  insertConsultation(store, consultation);
  return { ok: true, id: consultation.id };
}
