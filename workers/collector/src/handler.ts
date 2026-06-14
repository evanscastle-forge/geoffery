// Collector handler (spec §3): ingest live prices into the hot store + archive.
// Portable: takes the async storage seam + config, no direct env/runtime assumptions,
// so the same body runs under Node (main.node.ts) and a Cloudflare scheduled() entry.

import { assignSlugs } from "@geoffery/core";
import type { LatestPrice, Snapshot } from "@geoffery/core";
import {
  dayKey,
  existingSlugs,
  fetch5m,
  fetchLatest,
  fetchMapping,
  heartbeat,
  insertSnapshotsAsync,
  itemIdSet,
  mappingToItem,
  slugify,
  upsertItemStatement,
  upsertLatestStatement,
  type ArchiveStore,
  type SqlStore,
} from "@geoffery/data";

const ONE_DAY = 86400;
const BATCH = 100;

async function batchAll(store: SqlStore, statements: { sql: string; params?: unknown[] }[]): Promise<void> {
  for (let i = 0; i < statements.length; i += BATCH) {
    await store.batch(statements.slice(i, i + BATCH));
  }
}

export interface CollectResult {
  mappingRefreshed: boolean;
  latestRows: number;
  snapshotRows: number;
  bucketTs: number | null;
}

/** Refresh the item mapping if the catalogue is empty or older than 24h. */
async function refreshMappingIfStale(
  store: SqlStore,
  userAgent: string,
  now: number,
): Promise<boolean> {
  const newest = (await store.get<{ m: number | null }>("SELECT MAX(updated_at) AS m FROM items"))?.m ?? null;
  if (newest !== null && now - newest < ONE_DAY) return false;

  const mapping = await fetchMapping(userAgent);
  // Preserve already-minted slugs; assign deterministic slugs for new items.
  const known = await existingSlugs(store);
  const taken = new Set(known.values());
  const fresh = mapping.filter((m) => !known.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
  const minted = assignSlugs(fresh);
  const statements = mapping.map((m) => {
    let slug = known.get(m.id) ?? minted.get(m.id) ?? slugify(m.name);
    while (!known.has(m.id) && taken.has(slug) && minted.get(m.id) !== slug) slug = `${slug}-${m.id}`;
    taken.add(slug);
    return upsertItemStatement(mappingToItem(m, slug), now);
  });
  await batchAll(store, statements);
  return true;
}

export async function runCollect(
  store: SqlStore,
  archive: ArchiveStore,
  userAgent: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<CollectResult> {
  try {
    const mappingRefreshed = await refreshMappingIfStale(store, userAgent, now);
    // FK guard: only store prices for items we know about. One id-set read replaces
    // the per-row existence checks the old imperative transaction did (D1 has no
    // read-inside-batch), and it's faster.
    const known = await itemIdSet(store);

    // latest → prices_latest
    const latest: LatestPrice[] = (await fetchLatest(userAgent, now)).filter((p) => known.has(p.itemId));
    await batchAll(store, latest.map(upsertLatestStatement));

    // 5m → prices_5m hot window + archive
    const snaps: Snapshot[] = (await fetch5m(userAgent)).filter((s) => known.has(s.itemId));
    const bucketTs = snaps.length > 0 ? snaps[0]!.ts : null;
    const snapRows = await insertSnapshotsAsync(store, snaps);
    if (bucketTs !== null) await archive.appendDay(dayKey(bucketTs), snaps);

    await heartbeat(store, "collector", true);
    return { mappingRefreshed, latestRows: latest.length, snapshotRows: snapRows, bucketTs };
  } catch (e) {
    await heartbeat(store, "collector", false, String(e));
    throw e;
  }
}
