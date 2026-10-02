import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const run = file => { const child = spawnSync(process.execPath, [path.join(root, file)], { cwd: root, stdio: 'inherit' }); if (child.status !== 0) throw new Error(`${file} failed`); };
run('scripts/build-catalog.mjs');
await mkdir(path.join(root, 'dist/lib'), { recursive: true });
for (const file of ['core.mjs','analytics.mjs']) await copyFile(path.join(root, 'packages/lab', file), path.join(root, 'dist/lib', file));
await copyFile(path.join(root, 'LICENSE'), path.join(root, 'dist/LICENSE.txt'));
const runtimeReceipt = JSON.parse(await readFile(path.join(root, 'experiments/runtime/test-receipt.json'), 'utf8'));
const runtimeCoverage = JSON.parse(await readFile(path.join(root, 'experiments/runtime/coverage.json'), 'utf8'));
await writeFile(path.join(root, 'dist/data/runtime-evidence.json'), JSON.stringify({ ...runtimeReceipt, coverage: runtimeCoverage }, null, 2) + '\n');
// Preserve frozen observed wall times; a deterministic static build never reruns timing experiments.
await copyFile(path.join(root, 'experiments/runtime/scheduler-results.json'), path.join(root, 'dist/data/scheduler-results.json'));
// Original source stays outside publication; these are frozen derived synthetic evidence.
await copyFile(path.join(root, 'experiments/headspace/test-receipt.json'), path.join(root, 'dist/data/headspace-evidence.json'));
await copyFile(path.join(root, 'experiments/headspace/public-trace.json'), path.join(root, 'dist/data/headspace-trace.json'));
try { await readFile(path.join(root, 'dist/data/publication.json')); }
catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(root, 'dist/data/publication.json'), JSON.stringify({ author: 'novacanenumb', repositoryUrl: null, siteUrl: null, profileLinkStatus: 'UNAVAILABLE' }, null, 2) + '\n'); }
run('scripts/benchmark.mjs');
console.log('Static dossier built in dist; no provider calls.');
