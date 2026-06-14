// @geoffery/content — Geoffery's words + visual identity tokens (spec §9).
export * from "./lines.ts";
export * from "./donations.ts";
export { LEDGER } from "./ledger.ts";
export type { LedgerName } from "./ledger.ts";

import type { Tolerance } from "@geoffery/core";
import { TOLERANCE_WINDOW_PHRASE } from "./lines.ts";

export function toleranceWindowPhrase(t: Tolerance): string {
  return TOLERANCE_WINDOW_PHRASE[t] ?? "";
}
