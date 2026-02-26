import fs from 'node:fs';
import path from 'node:path';

const ROOTS = ['apps', 'packages'];
const ALLOWLIST = new Set([
  path.normalize('packages/theme/styles/neoslate-ember.css'),
]);
const IGNORE_DIRS = new Set(['node_modules', '.next', 'dist', 'build', 'coverage', '.turbo']);

const forbidden = [
  /#[0-9a-fA-F]{3,8}/,
  /\b(?:bg|text)-\[#/,
];

const textExtensions = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.mdx',
]);

const findings = [];

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    const rel = path.normalize(path.relative(process.cwd(), full));
    if (ALLOWLIST.has(rel)) continue;
    if (!textExtensions.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(full, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      for (const re of forbidden) {
        if (re.test(line)) {
          findings.push(`${rel}:${index + 1}: ${line.trim()}`);
          break;
        }
      }
    });
  }
}

ROOTS.forEach(walk);

if (findings.length) {
  console.error('Hard-coded colors found (hex or arbitrary hex Tailwind classes):');
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('PASS: no hard-coded hex or arbitrary hex Tailwind classes outside token files');
