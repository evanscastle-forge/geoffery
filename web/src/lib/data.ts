/* Typed access to the JSON snapshots produced by the Python pipeline.
 * The data flow is: pipeline writes → web/src/content/generated/*.json → Astro
 * reads them at build time. Nothing on the request path touches Python or SQL.
 */

import itemsRaw from '../content/generated/items.json';
import aggregatesRaw from '../content/generated/aggregates.json';
import sparklinesRaw from '../content/generated/sparklines.json';
import newsRaw from '../content/generated/news.json';
import metaRaw from '../content/generated/meta.json';

export type Item = {
  id: number;
  slug: string;
  name: string;
  members: boolean;
  icon: string | null;
};

export type Band = 'good' | 'average' | 'poor' | 'unsettled';

export type NewsCitation = { title: string; url: string; published_at: number };

export type Aggregate = {
  slug: string;
  name: string;
  band: Band;
  verdict_text: string;
  percentile: number | null;
  p25: number | null;
  p50: number | null;
  p75: number | null;
  current_price: number | null;
  flags: string[];
  sample_count: number;
  volume_24h: number;
  volume_baseline: number;
  computed_at: number;
  high: number | null;
  high_ts: number | null;
  low: number | null;
  low_ts: number | null;
  news_citations: NewsCitation[];
};

export type Sparkline = Record<'1d' | '1w' | '1m', Array<[number, number]>>;
export type NewsEntry = {
  published_at: number;
  title: string;
  url: string;
  categories: string[];
};

export const items = itemsRaw as Item[];
export const aggregates = aggregatesRaw as Record<string, Aggregate>;
export const sparklines = sparklinesRaw as Record<string, Partial<Sparkline>>;
export const news = newsRaw as NewsEntry[];
export const meta = metaRaw as { exported_at: number };

export function getAggregate(slug: string): Aggregate | null {
  return aggregates[slug] ?? null;
}
export function getSparkline(slug: string): Partial<Sparkline> {
  return sparklines[slug] ?? {};
}
