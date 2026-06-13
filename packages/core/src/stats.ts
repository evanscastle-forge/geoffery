// Tiny pure statistics helpers (mirrors Python's `statistics` where used).

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
