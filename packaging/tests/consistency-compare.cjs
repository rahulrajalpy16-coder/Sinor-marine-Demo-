// Test H: compares consistency results from different builds against the first file, field by field.
// Usage: node consistency-compare.cjs <tolerance> <reference.json> <other.json>...
// Numbers must agree within the absolute tolerance; text (events, alarms, states) must match exactly.
const fs = require('fs');
const [tolArg, ...files] = process.argv.slice(2);
const tol = Number(tolArg);
const load = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const ref = load(files[0]);
let failed = false;
function diff(a, b, at, out) {
  if (typeof a === 'number' && typeof b === 'number') {
    const d = Math.abs(a - b);
    if (!(d <= tol)) out.push(`${at}: ${a} vs ${b} (diff ${d})`);
    return d;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { out.push(`${at}: length ${a.length} vs ${b.length}`); return 0; }
    return a.reduce((m, v, i) => Math.max(m, diff(v, b[i], `${at}[${i}]`, out)), 0);
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    let m = 0;
    for (const k of keys) m = Math.max(m, diff(a[k], b[k], `${at}.${k}`, out) || 0);
    return m;
  }
  if (a !== b) out.push(`${at}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`);
  return 0;
}
const report = { tolerance: tol, reference: files[0], results: [] };
for (const f of files.slice(1)) {
  const out = [];
  const maxDiff = diff(ref, load(f), '', out);
  const pass = out.length === 0;
  failed ||= !pass;
  report.results.push({ file: f, pass, maxAbsDiff: maxDiff, mismatches: out.slice(0, 20), mismatchCount: out.length });
  console.log(pass ? 'PASS' : 'FAIL', f, 'max abs diff', maxDiff, out.length ? out.slice(0, 5).join('; ') : '');
}
console.log(JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
