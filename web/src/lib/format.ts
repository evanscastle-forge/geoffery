/* Number / time formatting. Geoffery's voice prefers plain language; numbers
 * are rendered with thousands separators and "gp" suffix for prices.
 */

const PRICE_FMT = new Intl.NumberFormat('en-US');

export function formatGp(n: number | null | undefined): string {
  if (n == null) return '—';
  return `${PRICE_FMT.format(Math.round(n))} gp`;
}

export function formatVolume(n: number | null | undefined): string {
  if (n == null || n === 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return PRICE_FMT.format(n);
}

export function timeAgo(unixSeconds: number | null | undefined, now = Date.now() / 1000): string {
  if (!unixSeconds) return 'never';
  const delta = Math.max(0, Math.floor(now - unixSeconds));
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}
