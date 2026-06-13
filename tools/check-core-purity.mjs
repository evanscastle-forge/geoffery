#!/usr/bin/env node
// Mechanical core-purity gate (spec §2 / GATE 2): packages/core performs zero I/O.
// Greps the core source for forbidden symbols. This is a belt-and-suspenders
// companion to the ESLint rule — it runs even if lint config drifts.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const CORE_DIR = new URL("../packages/core/src/", import.meta.url).pathname;

const FORBIDDEN = [
  { re: /from\s+["']node:/, msg: "node: builtin import" },
  { re: /from\s+["']@geoffery\/data/, msg: "import of storage adapter package" },
  { re: /from\s+["']better-sqlite3/, msg: "import of better-sqlite3" },
  { re: /\bfetch\s*\(/, msg: "fetch() call" },
  { re: /\bprocess\.env\b/, msg: "process.env access" },
  { re: /\brequire\s*\(/, msg: "require() call" },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

let violations = 0;
for (const file of walk(CORE_DIR)) {
  if (file.endsWith(".test.ts")) continue; // tests may use node:* for assertions
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const { re, msg } of FORBIDDEN) {
      if (re.test(line)) {
        console.error(`PURITY VIOLATION ${file}:${i + 1} — ${msg}\n    ${line.trim()}`);
        violations++;
      }
    }
  });
}

// §6 firewall: the offer engine imports nothing news/wiki-shaped.
const offers = join(CORE_DIR, "offers.ts");
for (const m of readFileSync(offers, "utf8").matchAll(/from\s+["']([^"']+)["']/g)) {
  if (/news|wiki/i.test(m[1])) {
    console.error(`FIREWALL VIOLATION offers.ts imports "${m[1]}" (spec §6)`);
    violations++;
  }
}

if (violations > 0) {
  console.error(`\ncore purity check FAILED: ${violations} violation(s)`);
  process.exit(1);
}
console.log("core purity check PASSED: packages/core is I/O-free");
