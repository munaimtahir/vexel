#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ADMIN_SRC = path.join(ROOT, 'apps', 'admin', 'src');
const OPENAPI = path.join(ROOT, 'packages', 'contracts', 'openapi.yaml');

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function collectOpenApiPaths(yamlText) {
  const set = new Set();
  const lines = yamlText.split(/\r?\n/);
  let inPaths = false;
  for (const line of lines) {
    if (!inPaths) {
      if (line.trim() === 'paths:') inPaths = true;
      continue;
    }
    if (/^[A-Za-z0-9_]+:/.test(line)) break; // next top-level section
    const m = line.match(/^  (\/\S+):\s*$/);
    if (m) set.add(normalizeEndpoint(m[1]));
  }
  return set;
}

function collectAdminEndpoints(filePath, text) {
  const found = [];
  const apiCall = /api\.(GET|POST|PATCH|PUT|DELETE)\(\s*(['"`])([^'"`]+)\2/g;
  let m;
  while ((m = apiCall.exec(text))) {
    found.push({ method: m[1], endpoint: m[3], file: filePath });
  }

  // Local wrappers that still call SDK internally (e.g., downloadFile('/catalog/templates/...'))
  const wrapperCall = /\b(downloadFile)\(\s*(['"`])([^'"`$]+)\2/g;
  while ((m = wrapperCall.exec(text))) {
    found.push({ method: 'GET', endpoint: m[3], file: filePath, viaWrapper: true });
  }

  return found;
}

function normalizeEndpoint(ep) {
  return ep.replace(/`/g, '').trim().replace(/\{[^}]+\}/g, '{}');
}

function shouldIgnoreEndpoint(ep) {
  if (!ep.startsWith('/')) return true;
  if (ep.includes('${')) return true; // dynamic template strings cannot be statically matched here
  return false;
}

function main() {
  const openApiPaths = collectOpenApiPaths(fs.readFileSync(OPENAPI, 'utf8'));
  const files = walk(ADMIN_SRC);
  const allRefs = files.flatMap((f) => collectAdminEndpoints(path.relative(ROOT, f), fs.readFileSync(f, 'utf8')));

  const refs = allRefs
    .map((r) => ({ ...r, endpoint: normalizeEndpoint(r.endpoint) }))
    .filter((r) => !shouldIgnoreEndpoint(r.endpoint));

  const missing = refs.filter((r) => !openApiPaths.has(r.endpoint));

  if (missing.length > 0) {
    console.error('Admin/OpenAPI parity check FAILED.');
    console.error('Referenced endpoints missing from packages/contracts/openapi.yaml:');
    for (const r of missing) console.error(`- ${r.endpoint} (${r.method}) in ${r.file}`);
    process.exit(1);
  }

  console.log(`Admin/OpenAPI parity check PASS. Checked ${refs.length} endpoint references across ${files.length} files.`);
}

main();
