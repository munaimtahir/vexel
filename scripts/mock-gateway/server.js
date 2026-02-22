const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const PRISM_URL = process.env.PRISM_URL || 'http://localhost:4010';

function loadFixtures() {
  const fixtures = {};
  const fixturesDir = path.join(__dirname, 'fixtures');
  function walk(dir, prefix) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name), `${prefix}/${entry.name}`);
      else if (entry.name.endsWith('.json')) {
        const key = `${prefix}/${entry.name.replace('.json', '')}`;
        try { fixtures[key] = JSON.parse(fs.readFileSync(path.join(dir, entry.name), 'utf8')); }
        catch(e) { console.error('Failed to load fixture', key, e.message); }
      }
    }
  }
  walk(fixturesDir, '');
  return fixtures;
}

const server = http.createServer((req, res) => {
  const scenario = req.headers['x-mock-scenario'];
  const fixtures = loadFixtures();
  if (scenario) {
    // Try: /method/path-segments/scenario
    // e.g. x-mock-scenario: encounters.list.ok → look in /encounters/list.ok
    const parts = scenario.split('.');
    if (parts.length >= 2) {
      const fixtureKey = '/' + parts.slice(0, -1).join('/') + '/' + parts.join('.');
      const simpleKey = '/' + parts[0] + '/' + parts.slice(1).join('.');
      const fixture = fixtures[fixtureKey] || fixtures[simpleKey];
      if (fixture) {
        const status = fixture._status || 200;
        const body = fixture._body || fixture;
        res.writeHead(status, { 'Content-Type': 'application/json', 'x-mock-scenario': scenario });
        return res.end(JSON.stringify(body));
      }
    }
  }
  // Forward to Prism
  const prismUrl = new URL(PRISM_URL);
  const options = {
    hostname: prismUrl.hostname, port: prismUrl.port || 4010,
    path: req.url, method: req.method,
    headers: { ...req.headers, host: prismUrl.host }
  };
  const proxy = http.request(options, (prismRes) => {
    res.writeHead(prismRes.statusCode, prismRes.headers);
    prismRes.pipe(res);
  });
  proxy.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Mock gateway error', detail: e.message }));
  });
  req.pipe(proxy);
});

server.listen(3000, () => console.log('Mock gateway running on :3000'));
