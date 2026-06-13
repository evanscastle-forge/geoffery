// Build-time data access. The site reads ONLY these generated JSON snapshots
// (spec §2) — never a database or external API at request time. Imported
// statically so Vite/Astro bundle them at build (server-side only; never shipped
// to the client unless a component references them in client code).

import itemsData from "../generated/items.json";
import aggregatesData from "../generated/aggregates.json";
import sparklinesData from "../generated/sparklines.json";
import methodologyData from "../generated/methodology-stats.json";
import metaData from "../generated/meta.json";
import newsData from "../generated/news.json";

export interface SearchItem {
  id: number;
  slug: string;
  name: string;
  members: boolean;
  icon: string | null;
}

export interface WikiNotice {
  kind: "upcoming" | "recent" | "past";
  title: string;
  summary: string;
  url: string;
  justification: string;
  confidence: number;
}

export interface AggregateView {
  slug: string;
  name: string;
  band: "good" | "average" | "poor" | "unsettled";
  verdictText: string;
  percentile: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  currentPrice: number | null;
  flags: string[];
  sampleCount: number;
  volume24h: number;
  volumeBaseline: number;
  computedAt: number;
  regimePower: "buyer" | "seller" | "balanced" | null;
  regimeStability: "steady" | "volatile" | null;
  liquidityBand: "thick" | "medium" | "thin" | null;
  rec: {
    instantBuy: number | null;
    instantSell: number | null;
    hoursBuy: number | null;
    hoursSell: number | null;
    patientBuy: number | null;
    patientSell: number | null;
    extendedBuy: number | null;
    extendedSell: number | null;
  };
  recFairKeys: string[];
  wikiNotices: WikiNotice[];
}

export type Sparkline = { d1: [number, number][]; w1: [number, number][]; m1: [number, number][] };

export interface CohortStat {
  nTotal: number;
  nFilled: number;
  fillRate: number;
}
export interface MethodologyStats {
  overall: CohortStat;
  byTolerance: Record<string, CohortStat>;
  cohorts: Record<string, CohortStat>;
  engineVersion: number;
  exportedAt: number;
}

export function items(): SearchItem[] {
  return itemsData as SearchItem[];
}
export function aggregates(): Record<string, AggregateView> {
  return aggregatesData as unknown as Record<string, AggregateView>;
}
export function sparklines(): Record<string, Sparkline> {
  return sparklinesData as unknown as Record<string, Sparkline>;
}
export function methodologyStats(): MethodologyStats {
  return methodologyData as MethodologyStats;
}
export function meta(): { exportedAt: number; deployment: string } {
  return metaData as { exportedAt: number; deployment: string };
}
export function newsList(): { id: string; title: string; summary: string; kind: string; at: number; wiki_url: string }[] {
  return newsData as { id: string; title: string; summary: string; kind: string; at: number; wiki_url: string }[];
}

export function aggregateForSlug(slug: string): AggregateView | undefined {
  return aggregates()[slug];
}
