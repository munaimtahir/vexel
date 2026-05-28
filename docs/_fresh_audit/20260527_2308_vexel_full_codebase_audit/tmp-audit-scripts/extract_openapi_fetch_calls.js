/* Audit-only helper: extract openapi-fetch calls from admin/operator source.
 * Output: JSON to stdout. Does not modify repo. */
const fs = require('fs');
const path = require('path');

const roots = [
  { app: 'admin', dir: 'apps/admin/src' },
  { app: 'operator', dir: 'apps/operator/src' },
];

const exts = new Set(['.ts', '.tsx', '.js', '.jsx']);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.next') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (exts.has(path.extname(ent.name))) out.push(p);
  }
  return out;
}

// Match: .GET('/path') / .POST("/path") / etc. (string literal only)
const re = /\.(GET|POST|PUT|PATCH|DELETE)\(\s*(["'`])([^"'`]+)\2/g;

const calls = [];
for (const r of roots) {
  if (!fs.existsSync(r.dir)) continue;
  const files = walk(r.dir);
  for (const f of files) {
    const txt = fs.readFileSync(f, 'utf8');
    let m;
    while ((m = re.exec(txt))) {
      const method = m[1];
      const endpoint = m[3];
      const line = txt.slice(0, m.index).split(/\r?\n/).length;
      calls.push({
        app: r.app,
        file: path.relative(process.cwd(), f),
        line,
        sdk_call: `client.${method}`,
        method,
        path: endpoint,
      });
    }
  }
}

process.stdout.write(
  JSON.stringify(
    { extractedAt: new Date().toISOString(), total: calls.length, calls },
    null,
    2,
  ),
);

