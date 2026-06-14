// R2 restore drill (spec §7/§11): prove the irreplaceable archive can be restored.
// Verifies every day object's sha256 against the manifest, then re-reads the whole
// archive through the SAME ArchiveStore reader into a FRESH in-memory store and
// confirms the row count reconciles with the manifest.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LocalArchiveStore, SqliteStore, insertSnapshots, loadConfig } from "@geoffery/data";
import { SCHEMA } from "@geoffery/data";

function main(): void {
  const cfg = loadConfig();
  const archive = new LocalArchiveStore(cfg.archiveDir);
  const manifest = archive.readManifest();
  if (!manifest) {
    console.error("no manifest — run `npm run migrate:legacy` first");
    process.exit(2);
  }

  let fail = 0;

  // 1) Integrity: sha256 of each object matches the manifest.
  for (const [day, m] of Object.entries(manifest.days)) {
    const actual = createHash("sha256").update(readFileSync(join(archive.root, m.object))).digest("hex");
    if (actual !== m.sha256) {
      console.error(`✗ sha mismatch ${day}`);
      fail++;
    }
  }
  console.log(`✓ sha256 integrity: ${Object.keys(manifest.days).length} day objects`);

  // 2) Restore: re-read every day through the ArchiveStore into a fresh store.
  const fresh = new SqliteStore(":memory:");
  fresh.execSync(SCHEMA);
  // Items must exist for the FK; load the dimension snapshot. Local-only restore
  // tool → rides SqliteStore's synchronous core directly.
  const items = archive.readItems<Record<string, unknown>>();
  fresh.transactionSync(() => {
    for (const it of items) {
      fresh.runSync(
        "INSERT INTO items (id, name, slug, members, updated_at) VALUES (?,?,?,?,0)",
        it.id,
        it.name,
        it.slug,
        it.members ?? 0,
      );
    }
  });
  // Restore the manifest-covered days and reconcile against totalRows. Days the
  // live collector appended after migration are a bonus, reported separately.
  const manifestDays = new Set(Object.keys(manifest.days));
  let restoredManifest = 0;
  let restoredLive = 0;
  for (const day of archive.listDays()) {
    const n = insertSnapshots(fresh, archive.readDay(day));
    if (manifestDays.has(day)) restoredManifest += n;
    else restoredLive += n;
  }

  if (restoredManifest !== manifest.totalRows) {
    console.error(`✗ restored ${restoredManifest} manifest rows, manifest says ${manifest.totalRows}`);
    fail++;
  } else {
    console.log(`✓ restored ${restoredManifest.toLocaleString()} rows = manifest total`);
  }
  if (restoredLive > 0) {
    console.log(`  (+ ${restoredLive.toLocaleString()} rows in ${archive.listDays().length - manifestDays.size} post-migration day(s) the collector appended)`);
  }
  fresh.close();

  console.log(fail === 0 ? "\nRESTORE DRILL PASS" : `\nRESTORE DRILL FAIL (${fail})`);
  process.exit(fail === 0 ? 0 : 1);
}

main();
