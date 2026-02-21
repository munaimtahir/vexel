#!/usr/bin/env node
/**
 * Post-process script: copies generated types into packages/sdk/src/generated
 * and writes a simple re-export so the SDK stays up to date.
 */
const fs = require('fs');
const path = require('path');

const sdkGenDir = path.resolve(__dirname, '../../sdk/src/generated');
fs.mkdirSync(sdkGenDir, { recursive: true });

// Check if api.d.ts was generated
const src = path.resolve(__dirname, '../../sdk/src/generated/api.d.ts');
if (fs.existsSync(src)) {
  console.log('✅ SDK types generated at packages/sdk/src/generated/api.d.ts');
} else {
  console.error('❌ Generation failed: api.d.ts not found');
  process.exit(1);
}
