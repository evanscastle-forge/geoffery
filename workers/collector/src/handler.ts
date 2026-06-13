// Collector handler (spec §3): ingest live prices into the hot store + archive.
// Portable: takes the storage seam + config, no direct env/runtime assumptions, so
// the same body runs under Node (main.node.ts) and a Cloudflare scheduled() entry.

import { assignSlugs } from "@geoffery/core";
import type { LatestPrice, Snapshot } from "@geoffery/core";
import {
  dayKey,
  existingSlugs,
  fetch5m,
  fetchLatest,
  fetchMapping,
  heartbeat,
  insertSnapshots,
  mappingToItem,
  slugify,
  upsertItem,
  upsertLatest,
  type LocalArchiveStore,
  type SqliteStore,
} from "@geoffery/data";

const ONE_DAY = 86400;

export interface CollectResult {
  mappingRefreshed: boolean;
  latestRows: number;
  snapshotRows: number;
  bucketTs: number | null;
}

/** Refresh the item mapping if the catalogue is empty or older than 24h. */
async function refreshMappingIfStale(
  store: SqliteStore,
  userAgent: string,
  now: number,
): Promise<boolean> {
  const newest = store.get<{ m: number | null }>("SELECT MAX(updated_at) AS m FROM items")?.m ?? null;
  if (newest !== null && now - newest < ONE_DAY) return false;

  const mapping = await fetchMapping(userAgent);
  // Preserve already-minted slugs; assign deterministic slugs for new items.
  const known = existingSlugs(store);
  const taken = new Set(known.values());
  const fresh = mapping.filter((m) => !known.has(m.id)).map((m) => ({ id: m.id, name: m.name }));
  const minted = assignSlugs(fresh);
  store.transaction(() => {
    for (const m of mapping) {
      let slug = known.get(m.id) ?? minted.get(m.id) ?? slugify(m.name);
      while (!known.has(m.id) && taken.has(slug) && minted.get(m.id) !== slug) slug = `${slug}-${m.id}`;
      taken.add(slug);
      upsertItem(store, mappingToItem(m, slug), now);
    }
  });
  return true;
}

export async function runCollect(
  store: SqliteStore,
  archive: LocalArchiveStore,
  userAgent: string,
  now: number = Math.floor(Date.now() / 1000),
): Promise<CollectResult> {
  try {
    const mappingRefreshed = await refreshMappingIfStale(store, userAgent, now);

    // latest → prices_latest
    const latest: LatestPrice[] = await fetchLatest(userAgent, now);
    store.transaction(() => {
      for (const p of latest) {
        // FK guard: only store latest for items we know about.
        if (store.get("SELECT 1 FROM items WHERE id = ?", p.itemId)) upsertLatest(store, p);
      }
    });

    // 5m → prices_5m hot window + archive
    const snaps: Snapshot[] = (await fetch5m(userAgent)).filter((s) =>
      store.get("SELECT 1 FROM items WHERE id = ?", s.itemId),
    );
    const bucketTs = snaps.length > 0 ? snaps[0]!.ts : null;
    const snapRows = insertSnapshots(store, snaps);
    if (bucketTs !== null) await archive.appendDay(dayKey(bucketTs), snaps);

    heartbeat(store, "collector", true);
    return { mappingRefreshed, latestRows: latest.length, snapshotRows: snapRows, bucketTs };
  } catch (e) {
    heartbeat(store, "collector", false, String(e));
    throw e;
  }
}
