// Bring up the whole product on localhost (spec §11 verify story). Long-lived
// children: the consult worker (Hono, :8787) and the Astro dev site (:4321, which
// proxies /api to the worker). A lightweight scheduler stands in for Cloudflare
// Cron Triggers: collect every 5 min (cheap), scorer every 30 min, aggregate +
// export hourly (heavy), news every 6 h. Heavy jobs run as child processes so they
// never block the consult worker or the site.

import { spawn, type ChildProcess } from "node:child_process";
import { loadConfig } from "@geoffery/data";

const cfg = loadConfig();
const NODE = process.execPath;
const STRIP = "--experimental-strip-types";
const children: ChildProcess[] = [];

function longLived(name: string, args: string[]): void {
  const c = spawn(NODE, args, { stdio: "inherit", env: process.env });
  c.on("exit", (code) => console.log(`[${name}] exited (${code})`));
  children.push(c);
}

let busy = false;
function job(name: string, entry: string): void {
  if (busy) {
    console.log(`[scheduler] skip ${name} (a job is already running)`);
    return;
  }
  busy = true;
  console.log(`[scheduler] ▶ ${name}`);
  const c = spawn(NODE, [STRIP, entry], { stdio: "inherit", env: process.env });
  c.on("exit", (code) => {
    busy = false;
    console.log(`[scheduler] ${name} done (${code})`);
  });
}

const MIN = 60_000;

console.log("Geoffery dev stack starting…");
console.log(`  consult worker → http://127.0.0.1:${cfg.consultPort}`);
console.log(`  site           → ${cfg.siteUrl}`);

// Long-lived services.
longLived("consult", [STRIP, "workers/consult/src/main.node.ts"]);
const site = spawn("npm", ["run", "dev:site"], { stdio: "inherit", env: { ...process.env, GEOFFERY_SITE_URL: cfg.siteUrl } });
site.on("exit", (code) => console.log(`[site] exited (${code})`));
children.push(site);

// Scheduler. First collect shortly after boot so freshness ticks immediately.
setTimeout(() => job("collect", "workers/collector/src/main.node.ts"), 10_000);
setInterval(() => job("collect", "workers/collector/src/main.node.ts"), 5 * MIN);
setInterval(() => job("scorer", "workers/scorer/src/main.node.ts"), 30 * MIN);
setInterval(() => job("aggregate+export", "ops/scheduler/run-aggregate-export.ts"), 60 * MIN);
setInterval(() => job("news", "workers/news/src/main.node.ts"), 6 * 60 * MIN);

function shutdown(): void {
  console.log("\nshutting down…");
  for (const c of children) c.kill("SIGTERM");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
