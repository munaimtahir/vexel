/* Audit-only helper: convert extracted truthmap JSON to CSV. */
const fs = require('fs');

const inFile = process.argv[2];
if (!inFile) {
  console.error('Usage: node truthmap_json_to_csv.js <truthmap.json>');
  process.exit(2);
}

const j = JSON.parse(fs.readFileSync(inFile, 'utf8'));
const rows = [['app', 'file', 'line', 'sdk_call', 'method', 'path']];
for (const c of j.calls || []) {
  rows.push([c.app, c.file, String(c.line), c.sdk_call, c.method, c.path]);
}

function esc(v) {
  return `"${String(v ?? '').replaceAll('"', '""')}"`;
}

process.stdout.write(rows.map((r) => r.map(esc).join(',')).join('\n'));

