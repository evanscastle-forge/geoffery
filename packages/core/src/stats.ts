// Tiny pure statistics helpers (mirrors Python's `statistics` where used).

/** Standard normal CDF Φ via the Abramowitz & Stegun 7.1.26 erf approximation. */
export function normCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp((-x * x) / 2);
  const p =
    d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0 ? 1 - p : p;
}

/** Inverse standard normal Φ⁻¹ (Acklam's rational approximation; |err| < 1.15e-9). */
export function normInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const pl = 0.02425;
  let q: number, r: number;
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
  }
  if (p <= 1 - pl) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0]! * r + a[1]!) * r + a[2]!) * r + a[3]!) * r + a[4]!) * r + a[5]!) * q / (((((b[0]! * r + b[1]!) * r + b[2]!) * r + b[3]!) * r + b[4]!) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0]! * q + c[1]!) * q + c[2]!) * q + c[3]!) * q + c[4]!) * q + c[5]!) / ((((d[0]! * q + d[1]!) * q + d[2]!) * q + d[3]!) * q + 1);
}

/** Median of an array (does not mutate the input). */
export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/**
 * Robust per-step volatility of a price series: the scaled median-absolute-deviation
 * of its log returns. MAD·1.4826 ≈ the stdev for normal data but shrugs off spikes
 * (a single bad print barely moves it). Returns a small positive floor when the
 * series is too short or degenerate, so downstream √n scaling stays finite.
 */
export function robustLogVol(chronoPrices: number[], floor = 1e-4): number {
  const rets: number[] = [];
  for (let i = 1; i < chronoPrices.length; i++) {
    const a = chronoPrices[i - 1]!;
    const b = chronoPrices[i]!;
    if (a > 0 && b > 0) rets.push(Math.log(b / a));
  }
  if (rets.length < 3) return floor;
  const med = median(rets);
  const mad = median(rets.map((r) => Math.abs(r - med)));
  return Math.max(floor, 1.4826 * mad);
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  let sum = 0;
  for (const x of xs) sum += x;
  return sum / xs.length;
}

/** Population standard deviation (Python statistics.pstdev). */
export function pstdev(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  let acc = 0;
  for (const x of xs) acc += (x - m) ** 2;
  return Math.sqrt(acc / xs.length);
}

/** Rolling population stdev over fixed-size windows. O(n) via prefix sums
 *  (equivalent to slicing + pstdev per window, but without the allocation). */
export function rollingVolatility(prices: number[], window: number): number[] {
  const n = prices.length;
  if (n < window || window < 2) return [];
  const s1 = new Float64Array(n + 1);
  const s2 = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const x = prices[i]!;
    s1[i + 1] = s1[i]! + x;
    s2[i + 1] = s2[i]! + x * x;
  }
  const out: number[] = [];
  for (let i = window; i <= n; i++) {
    const sum = s1[i]! - s1[i - window]!;
    const sumSq = s2[i]! - s2[i - window]!;
    const mean = sum / window;
    const variance = Math.max(0, sumSq / window - mean * mean);
    out.push(Math.sqrt(variance));
  }
  return out;
}
