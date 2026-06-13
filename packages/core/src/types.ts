// Shared domain types. Pure data shapes — no behavior, no I/O (spec §2).

export type Side = "buy" | "sell";
export type Tolerance = "instant" | "hours" | "patient";
export type Band = "good" | "average" | "poor" | "unsettled";
export type RegimePower = "buyer" | "seller" | "balanced";
export type RegimeStability = "steady" | "volatile";
export type LiquidityBand = "thick" | "medium" | "thin";

/** Master catalogue entry. `slug` is an immutable URL one-way door (spec §4 SEO). */
export interface Item {
  id: number;
  name: string;
  slug: string;
  examine: string | null;
  members: boolean;
  geLimit: number | null;
  value: number | null;
  highalch: number | null;
  lowalch: number | null;
  icon: string | null;
}

/** One 5-minute bucket from the wiki `5m` endpoint. avg_* are volume-weighted. */
export interface Snapshot {
  itemId: number;
  ts: number;
  avgHigh: number | null;
  avgLow: number | null;
  highVol: number | null;
  lowVol: number | null;
}

/** Current insta-buy (high) / insta-sell (low) from the wiki `latest` endpoint. */
export interface LatestPrice {
  itemId: number;
  high: number | null;
  highTs: number | null;
  low: number | null;
  lowTs: number | null;
  fetchedAt: number;
}

export interface RegimeResult {
  power: RegimePower;
  stability: RegimeStability;
  trendPct: number;
  highShare: number;
  volatilityZ: number;
  /** True when a relevant wiki update broke a borderline volatility tie (spec §6 §D-013). */
  newsContributed: boolean;
}

/** A single rounded recommendation for one (side, tolerance). */
export interface Recommendation {
  side: Side;
  tolerance: Tolerance;
  price: number;
  /** cohort key shape: `tolerance/side/liquidity/stability`. */
  confidenceBucket: string;
  engineVersion: number;
}

/** Output of the algorithms layer for one item; what the site renders. */
export interface Aggregate {
  itemId: number;
  computedAt: number;
  sampleCount: number;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  currentPrice: number | null;
  currentPercentile: number | null;
  band: Band;
  verdictText: string;
  flags: string[];
  volume24h: number;
  volumeBaseline: number;
  regimePower: RegimePower | null;
  regimeStability: RegimeStability | null;
  liquidityBand: LiquidityBand | null;
  recInstantBuy: number | null;
  recInstantSell: number | null;
  recHoursBuy: number | null;
  recHoursSell: number | null;
  recPatientBuy: number | null;
  recPatientSell: number | null;
  engineVersion: number;
}

/** A falsifiable prediction logged at consultation issue time (spec §5). */
export interface Consultation {
  id: string;
  clientId: string;
  itemId: number;
  side: Side;
  tolerance: Tolerance;
  recommendedPrice: number;
  regimePower: RegimePower | null;
  regimeStability: RegimeStability | null;
  liquidityBand: LiquidityBand | null;
  confidenceBucket: string;
  engineVersion: number;
  createdAt: number;
}

/** Scorer output: did the recommended price trade through within the window. */
export interface Outcome {
  consultationId: string;
  filled: boolean;
  filledAt: number | null;
  evalWindowStart: number;
  evalWindowEnd: number;
  evaluatedAt: number;
}

export interface Calibration {
  cohortKey: string;
  nTotal: number;
  nFilled: number;
  fillRate: number;
}

export type Tier =
  | "bronze"
  | "iron"
  | "steel"
  | "black"
  | "mithril"
  | "adamant"
  | "rune"
  | "dragon";

export interface LedgerEntry {
  name: string;
  score: number;
  tier: Tier;
  founding: boolean;
  activeSeal: boolean;
}
