import { normalizeMobile } from './mobile.utils';

const tests = [
    { input: '12341234567', expected: '1234-1234567' },
    { input: '1234-1234567', expected: '1234-1234567' },
    { input: '03001234567', expected: '0300-1234567' },
    { input: '0300-1234567', expected: '0300-1234567' },
    { input: '123', expected: '123' },
    { input: 'abcdefghijk', expected: 'abcdefghijk' }, // should not crash
    { input: null, expected: null },
    { input: undefined, expected: undefined },
    { input: '', expected: '' },
];

let failed = false;
for (const test of tests) {
    const actual = normalizeMobile(test.input as any);
    if (actual === test.expected) {
        console.log(`✅ PASS: "${test.input}" -> "${actual}"`);
    } else {
        console.log(`❌ FAIL: "${test.input}" -> expected "${test.expected}", got "${actual}"`);
        failed = true;
    }
}

if (failed) {
    process.exit(1);
} else {
    console.log('\nAll tests passed!');
}
