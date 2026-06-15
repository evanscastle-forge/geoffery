// Node-only entry (@geoffery/data/node): the full portable @geoffery/data surface
// PLUS the local node:sqlite store (SqliteStore/openStore from ./db.node.ts).
// Imported by CLI tools, schedulers, .node.ts worker entries, and tests — never by
// a Cloudflare worker.ts, which imports the portable "@geoffery/data" barrel so its
// bundle never reaches node:sqlite.
export * from "./index.ts";
export * from "./db.node.ts";
