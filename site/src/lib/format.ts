// Presentation helpers. Live market figures may render exact (spec §5); only
// recommendations are pre-rounded by the engine.

export function gp(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.round(n).toLocaleString("en-US");
}

/** Compact gp for tight spaces: 1.6b / 38.5k. */
export function gpShort(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  const a = Math.abs(n);
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}b`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}m`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return `${Math.round(n)}`;
}

/** "41 seconds ago" — must be true (spec §4). Computed relative to a reference now. */
export function ago(ts: number | null | undefined, now = Math.floor(Date.now() / 1000)): string {
  if (!ts) return "unknown";
  const s = Math.max(0, now - ts);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"} ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.floor(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function itemTitle(name: string): string {
  return `${name} GE price & deal rating — Geoffery`;
}

export function metaDescription(name: string, verdict: string): string {
  return `Current OSRS Grand Exchange price for ${name}. ${verdict} Geoffery keeps the ledger.`;
}
