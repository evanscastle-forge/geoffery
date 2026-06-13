// R2 raw-history archive (spec §2): append-only daily files, the irreplaceable asset.
// Local stand-in = a directory of gzipped NDJSON, one object per UTC day, plus a manifest.
// One reader (`ArchiveStore`) is shared by migrate-legacy, the collector backfill, the
// aggregator, and the backtest — so they cannot drift.

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createGzip, gunzipSync, gzipSync } from "node:zlib";
import { join } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import type { Snapshot } from "@geoffery/core";

export const ARCHIVE_SCHEMA_VERSION = 1;
const DAY_SECONDS = 86400;

/** Compact on-disk line shape (short keys to shrink gzipped files). */
interface ArchiveLine {
  i: number;
  t: number;
  ah: number | null;
  al: number | null;
  hv: number | null;
  lv: number | null;
}

export interface DayManifest {
  object: string;
  rows: number;
  minTs: number;
  maxTs: number;
  sha256?: string;
}

export interface ArchiveManifest {
  schemaVersion: number;
  generator: string;
  generatedAt: number;
  totalRows: number;
  days: Record<string, DayManifest>;
}

export function dayKey(ts: number): string {
  return new Date(Math.floor(ts / DAY_SECONDS) * DAY_SECONDS * 1000)
    .toISOString()
    .slice(0, 10);
}

function lineToSnapshot(l: ArchiveLine): Snapshot {
  return { itemId: l.i, ts: l.t, avgHigh: l.ah, avgLow: l.al, highVol: l.hv, lowVol: l.lv };
}

function snapshotToLine(s: Snapshot): ArchiveLine {
  return { i: s.itemId, t: s.ts, ah: s.avgHigh, al: s.avgLow, hv: s.highVol, lv: s.lowVol };
}

/** The archive interface that prod (R2) and local (filesystem) both implement. */
export interface ArchiveStore {
  listDays(): string[];
  readDay(day: string): Snapshot[];
  /** Snapshots with `fromTs <= ts < toTs`, ascending by ts, across day boundaries. */
  streamRange(fromTs: number, toTs: number): Iterable<Snapshot>;
  readManifest(): ArchiveManifest | null;
}

export class LocalArchiveStore implements ArchiveStore {
  readonly root: string;
  private readonly pricesDir: string;
  private readonly manifestPath: string;

  constructor(root: string) {
    this.root = root;
    this.pricesDir = join(root, "prices_5m");
    this.manifestPath = join(root, "manifest.json");
  }

  private objectPath(day: string): string {
    return join(this.pricesDir, `${day}.ndjson.gz`);
  }

  listDays(): string[] {
    if (!existsSync(this.pricesDir)) return [];
    return readdirSync(this.pricesDir)
      .filter((f) => f.endsWith(".ndjson.gz"))
      .map((f) => f.replace(/\.ndjson\.gz$/, ""))
      .sort();
  }

  /** Hard-prune the archive cache: keep only the most recent `keepDays` day files. */
  pruneDays(keepDays = 30): number {
    const days = this.listDays(); // ascending
    const drop = days.slice(0, Math.max(0, days.length - keepDays));
    for (const day of drop) {
      const p = this.objectPath(day);
      if (existsSync(p)) rmSync(p);
    }
    return drop.length;
  }

  readDay(day: string): Snapshot[] {
    const path = this.objectPath(day);
    if (!existsSync(path)) return [];
    const text = gunzipSync(readFileSync(path)).toString("utf8");
    const out: Snapshot[] = [];
    for (const line of text.split("\n")) {
      if (!line) continue;
      out.push(lineToSnapshot(JSON.parse(line) as ArchiveLine));
    }
    return out;
  }

  *streamRange(fromTs: number, toTs: number): Iterable<Snapshot> {
    for (const day of this.listDays()) {
      // Skip whole days that cannot overlap the window.
      const dayStart = Date.parse(`${day}T00:00:00Z`) / 1000;
      if (dayStart + DAY_SECONDS <= fromTs || dayStart >= toTs) continue;
      for (const snap of this.readDay(day)) {
        if (snap.ts >= fromTs && snap.ts < toTs) yield snap;
      }
    }
  }

  readManifest(): ArchiveManifest | null {
    if (!existsSync(this.manifestPath)) return null;
    return JSON.parse(readFileSync(this.manifestPath, "utf8")) as ArchiveManifest;
  }

  // ---- writers (used by migration + collector append) ----

  /** Atomically write a full day's snapshots (ascending ts), returning its manifest entry. */
  async writeDay(day: string, snapshots: Snapshot[]): Promise<DayManifest> {
    mkdirSync(this.pricesDir, { recursive: true });
    const tmp = this.objectPath(day) + ".tmp";
    const ndjson = snapshots.map((s) => JSON.stringify(snapshotToLine(s))).join("\n") + "\n";
    await pipeline(Readable.from([ndjson]), createGzip(), createWriteStream(tmp));
    renameSync(tmp, this.objectPath(day));
    let minTs = Infinity;
    let maxTs = -Infinity;
    for (const s of snapshots) {
      if (s.ts < minTs) minTs = s.ts;
      if (s.ts > maxTs) maxTs = s.ts;
    }
    return { object: `prices_5m/${day}.ndjson.gz`, rows: snapshots.length, minTs, maxTs };
  }

  /** Item dimension snapshot taken at migration time (raw legacy column shape). */
  writeItems(items: unknown[]): void {
    mkdirSync(this.root, { recursive: true });
    const path = join(this.root, "items.json.gz");
    const tmp = path + ".tmp";
    const gz = gzipSync(Buffer.from(JSON.stringify(items), "utf8"));
    writeFileSync(tmp, gz);
    renameSync(tmp, path);
  }

  readItems<T = Record<string, unknown>>(): T[] {
    const path = join(this.root, "items.json.gz");
    if (!existsSync(path)) return [];
    return JSON.parse(gunzipSync(readFileSync(path)).toString("utf8")) as T[];
  }

  /** Merge new snapshots into a day object (dedupe by item+ts), keeping it ascending. */
  async appendDay(day: string, snapshots: Snapshot[]): Promise<DayManifest> {
    const existing = this.readDay(day);
    const byKey = new Map<string, Snapshot>();
    for (const s of existing) byKey.set(`${s.itemId}:${s.ts}`, s);
    for (const s of snapshots) byKey.set(`${s.itemId}:${s.ts}`, s);
    const merged = [...byKey.values()].sort((a, b) => a.ts - b.ts || a.itemId - b.itemId);
    return this.writeDay(day, merged);
  }

  writeManifest(manifest: ArchiveManifest): void {
    mkdirSync(this.root, { recursive: true });
    const tmp = this.manifestPath + ".tmp";
    writeFileSync(tmp, JSON.stringify(manifest, null, 2));
    renameSync(tmp, this.manifestPath);
  }
}

/** Streaming writer for the multi-million-row migration: appends lines to one day's gz
 *  without buffering the whole day in memory. */
export class DayWriter {
  private readonly gzip = createGzip();
  private readonly done: Promise<void>;
  private rows = 0;
  private minTs = Infinity;
  private maxTs = -Infinity;
  private readonly tmp: string;
  private readonly finalPath: string;
  readonly day: string;

  constructor(store: LocalArchiveStore, day: string) {
    this.day = day;
    mkdirSync(join(store.root, "prices_5m"), { recursive: true });
    this.finalPath = join(store.root, "prices_5m", `${day}.ndjson.gz`);
    this.tmp = this.finalPath + ".tmp";
    this.done = pipeline(this.gzip, createWriteStream(this.tmp));
  }

  write(s: Snapshot): void {
    this.rows++;
    if (s.ts < this.minTs) this.minTs = s.ts;
    if (s.ts > this.maxTs) this.maxTs = s.ts;
    this.gzip.write(JSON.stringify(snapshotToLine(s)) + "\n");
  }

  async close(): Promise<DayManifest> {
    this.gzip.end();
    await this.done;
    renameSync(this.tmp, this.finalPath);
    return {
      object: `prices_5m/${this.day}.ndjson.gz`,
      rows: this.rows,
      minTs: this.minTs,
      maxTs: this.maxTs,
    };
  }
}
