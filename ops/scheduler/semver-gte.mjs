// Exit 0 if version A >= version B (numeric major.minor.patch; a leading "v" and any
// "-prerelease" suffix are ignored). Used by ops/run.sh's prod regression guard.
// Usage: node ops/scheduler/semver-gte.mjs <A> <B>
const parse = (v) =>
  String(v ?? "0")
    .replace(/^v/, "")
    .split("-")[0]
    .split(".")
    .map((n) => parseInt(n, 10) || 0);

const a = parse(process.argv[2]);
const b = parse(process.argv[3]);
for (let i = 0; i < 3; i++) {
  const x = a[i] ?? 0;
  const y = b[i] ?? 0;
  if (x > y) process.exit(0);
  if (x < y) process.exit(1);
}
process.exit(0); // equal → not a regression
