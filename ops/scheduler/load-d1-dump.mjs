// Load a `wrangler d1 export` SQL dump into a fresh local node:sqlite database, so the
// node export (ops/scheduler/export.ts) can read production data unchanged. This is the
// thin bridge that lets `ops/run.sh <env> publish` (and CI) build the static site from
// live D1 data without a remote-D1 read path in the export itself.
//
// Usage: node ops/scheduler/load-d1-dump.mjs <dump.sql> <out.db>
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

const [dumpPath, dbPath] = process.argv.slice(2);
if (!dumpPath || !dbPath) {
  console.error("usage: node ops/scheduler/load-d1-dump.mjs <dump.sql> <out.db>");
  process.exit(2);
}

mkdirSync(dirname(dbPath), { recursive: true });
rmSync(dbPath, { force: true }); // a snapshot is always rebuilt from scratch

const sql = readFileSync(dumpPath, "utf8");
const db = new DatabaseSync(dbPath);
try {
  // The dump is plain SQLite DDL + INSERTs (wrangler strips D1-only artefacts);
  // exec runs the whole script in one pass.
  db.exec(sql);
} finally {
  db.close();
}
console.log(`loaded D1 dump (${sql.length} bytes) → ${dbPath}`);
