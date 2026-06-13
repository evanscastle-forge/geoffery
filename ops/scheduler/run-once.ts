// One-shot pipeline (spec §11 "cron"): collect → aggregate → news → export, in
// order. Each step is a child process so a slow/blocking step can't wedge the
// others and DB connections stay isolated. This is `npm run pipeline`.

import { spawnSync } from "node:child_process";

const STEPS: [string, string][] = [
  ["collect", "workers/collector/src/main.node.ts"],
  ["prune", "ops/scheduler/prune.node.ts"], // keep the cache to a rolling 30 days
  ["aggregate", "workers/aggregator/src/main.node.ts"],
  ["news", "workers/news/src/main.node.ts"],
  ["export", "ops/scheduler/export.ts"],
];

for (const [name, entry] of STEPS) {
  console.log(`\n▶ ${name}`);
  const r = spawnSync(process.execPath, ["--experimental-strip-types", entry], {
    stdio: "inherit",
    env: process.env,
  });
  if (r.status !== 0) {
    console.error(`✗ ${name} failed (exit ${r.status}); stopping pipeline`);
    process.exit(r.status ?? 1);
  }
}
console.log("\n✓ pipeline complete");
