// Aggregate then export, in order (the periodic "refresh the site data" job).
import { spawnSync } from "node:child_process";

for (const [name, entry] of [
  ["aggregate", "workers/aggregator/src/main.node.ts"],
  ["export", "ops/scheduler/export.ts"],
] as const) {
  const r = spawnSync(process.execPath, ["--experimental-strip-types", entry], { stdio: "inherit", env: process.env });
  if (r.status !== 0) {
    console.error(`${name} failed`);
    process.exit(r.status ?? 1);
  }
}
