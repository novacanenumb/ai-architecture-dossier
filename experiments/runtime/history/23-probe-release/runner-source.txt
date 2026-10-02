import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { verifyRuntime } from '../experiments/runtime/tests/runtime-helper.mjs';

const root = path.resolve(import.meta.dirname, '..');
const verified = await verifyRuntime();
const files = ['experiments/runtime/tests/context-generation.test.mjs', 'experiments/runtime/tests/evidence-performance.test.mjs'];
const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...files], {
  cwd: root, encoding: 'utf8', timeout: 120000,
  env: { ...process.env, DOSSIER_RUNTIME_PATH: verified.root }
});
const output = (result.stdout || '') + (result.stderr || '');
const count = key => Number(output.match(new RegExp('^# ' + key + ' (\\d+)$', 'm'))?.[1] ?? NaN);
const tests = [...output.matchAll(/^(ok|not ok) \d+ - (.+)$/gm)].map(m => ({ name: m[2], status: m[1] === 'ok' ? 'PASSED' : 'FAILED', componentIds: [...new Set(m[2].match(/C\d{2}/g) || [])] }));
const sourceHashes = {};
for (const file of [...files, 'experiments/runtime/tests/runtime-helper.mjs', 'scripts/test-supplied-runtime.mjs']) {
  sourceHashes[file] = 'sha256:' + createHash('sha256').update(await readFile(path.join(root, file))).digest('hex');
}
const receipt = {
  schemaVersion: 1, kind: 'supplied-runtime-behavioral-evidence',
  status: result.status === 0 && count('fail') === 0 && count('skipped') === 0 && tests.length === count('tests') ? 'PASSED' : 'FAILED',
  command: 'npm run test:runtime', nodeVersion: process.version, platform: process.platform,
  exitCode: result.status, error: result.error?.code ?? null,
  passed: count('pass'), failed: count('fail'), skipped: count('skipped'), total: count('tests'), tests,
  dependency: { version: verified.version, manifestHash: verified.manifestHash, contentRoot: verified.contentRoot, verifiedFiles: verified.verifiedFiles },
  sourceHashes,
  inspectedRuntimeSources: Object.fromEntries(Object.entries(verified.sourceHashes).filter(([file]) => /\/(?:context|generation|evidence|broker|performance|core)\.mjs$/.test(file))),
  provenance: { measurements: 'locally executed behavioral probes with public synthetic inputs', providerCalls: 0, hostedTokens: null, billedCost: null, hostedLatencyMs: null, modelQuality: null, hostedDeterminism: 'not established', sourceRedistributed: false },
  acceptanceScope: 'Partial component mechanism evidence; not completion of all acceptance requirements or a standalone-model comparison.'
};
await mkdir(path.join(root, 'experiments/runtime'), { recursive: true });
await writeFile(path.join(root, 'experiments/runtime/test-receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(output);
console.log(JSON.stringify({ ...receipt, sourceHashes: undefined, inspectedRuntimeSources: undefined, tests: undefined }));
if (receipt.status !== 'PASSED') process.exitCode = 1;
