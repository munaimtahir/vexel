#!/usr/bin/env node
const http = require('http');

const GATEWAY = process.env.MOCK_GATEWAY_URL || 'http://127.0.0.1:9031';
let passed = 0; let failed = 0;

function request(path, scenario, expectedStatus) {
  return new Promise((resolve) => {
    const url = new URL(path, GATEWAY);
    const opts = { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: 'GET',
      headers: { 'x-mock-scenario': scenario, 'Content-Type': 'application/json' } };
    const req = http.request(opts, (res) => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        const ok = res.statusCode === expectedStatus;
        console.log(`${ok ? '✅ PASS' : '❌ FAIL'} [${scenario}] → HTTP ${res.statusCode} (expected ${expectedStatus})`);
        if (!ok) console.log('  Body:', body.slice(0, 200));
        ok ? passed++ : failed++;
        resolve();
      });
    });
    req.on('error', (e) => { console.log(`❌ FAIL [${scenario}] → Error: ${e.message}`); failed++; resolve(); });
    req.end();
  });
}

async function run() {
  console.log(`\nMock Smoke Test — ${GATEWAY}\n${'─'.repeat(60)}`);
  await request('/api/encounters', 'encounters.list.ok', 200);
  await request('/api/encounters/enc-001', 'encounters.get.ok', 200);
  await request('/api/patients', 'patients.list.ok', 200);
  await request('/api/documents', 'documents.list.ok', 200);
  // Error scenarios
  await request('/api/auth/login', 'auth.login.401', 401);
  await request('/api/encounters/enc-001:order-lab', 'encounters.command.transition_409', 409);
  await request('/api/patients', 'patients.create.422', 422);
  await request('/api/documents/doc-001/download', 'documents.download.403', 403);

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.log('❌ SMOKE FAILED'); process.exit(1); }
  else console.log('✅ ALL SMOKE CHECKS PASSED');
}

run();
