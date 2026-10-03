import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const run = file => { const child = spawnSync(process.execPath, [path.join(root, file)], { cwd: root, stdio: 'inherit' }); if (child.status !== 0) throw new Error(`${file} failed`); };
run('scripts/build-catalog.mjs');
await mkdir(path.join(root, 'dist/lib'), { recursive: true });
for (const file of ['core.mjs','analytics.mjs','language-analysis.mjs','language-fixture.mjs']) await copyFile(path.join(root, 'packages/lab', file), path.join(root, 'dist/lib', file));
await copyFile(path.join(root, 'LICENSE'), path.join(root, 'dist/LICENSE.txt'));
const runtimeReceipt = JSON.parse(await readFile(path.join(root, 'experiments/runtime/test-receipt.json'), 'utf8'));
const runtimeCoverage = JSON.parse(await readFile(path.join(root, 'experiments/runtime/coverage.json'), 'utf8'));
await writeFile(path.join(root, 'dist/data/runtime-evidence.json'), JSON.stringify({ ...runtimeReceipt, coverage: runtimeCoverage }, null, 2) + '\n');
// Preserve frozen observed wall times; a deterministic static build never reruns timing experiments.
await copyFile(path.join(root, 'experiments/runtime/scheduler-results.json'), path.join(root, 'dist/data/scheduler-results.json'));
await copyFile(path.join(root, 'experiments/routing/test-receipt.json'), path.join(root, 'dist/data/routing-evidence.json'));
const rotorReceipt=JSON.parse(await readFile(path.join(root,'experiments/rotor/test-receipt.json'),'utf8'));
const rotorCoverage=JSON.parse(await readFile(path.join(root,'experiments/rotor/coverage.json'),'utf8'));
await writeFile(path.join(root,'dist/data/rotor-evidence.json'),JSON.stringify({...rotorReceipt,coverage:rotorCoverage},null,2)+'\n');
await copyFile(path.join(root,'experiments/rotor/trace.json'),path.join(root,'dist/data/rotor-trace.json'));
const nativeModelReceipt=JSON.parse(await readFile(path.join(root,'experiments/native-model/test-receipt.json'),'utf8'));
const nativeModelCoverage=JSON.parse(await readFile(path.join(root,'experiments/native-model/coverage.json'),'utf8'));
await writeFile(path.join(root,'dist/data/native-model-evidence.json'),JSON.stringify({...nativeModelReceipt,coverage:nativeModelCoverage},null,2)+'\n');
await copyFile(path.join(root,'experiments/native-model/summary.json'),path.join(root,'dist/data/native-model-summary.json'));
// Original source stays outside publication; these are frozen derived synthetic evidence.
await copyFile(path.join(root, 'experiments/headspace/test-receipt.json'), path.join(root, 'dist/data/headspace-evidence.json'));
await copyFile(path.join(root, 'experiments/headspace/public-trace.json'), path.join(root, 'dist/data/headspace-trace.json'));
const agentdbReceipt=JSON.parse(await readFile(path.join(root,'experiments/agentdb/test-receipt.json'),'utf8'));
const languageResults=JSON.parse(await readFile(path.join(root,'experiments/language/results.json'),'utf8'));
const languageCoverage=JSON.parse(await readFile(path.join(root,'experiments/language/coverage.json'),'utf8'));
await writeFile(path.join(root,'dist/data/language-results.json'),JSON.stringify({...languageResults,coverage:languageCoverage},null,2)+'\n');
const agentdbCoverage=JSON.parse(await readFile(path.join(root,'experiments/agentdb/coverage.json'),'utf8'));
await writeFile(path.join(root,'dist/data/agentdb-evidence.json'),JSON.stringify({...agentdbReceipt,coverage:agentdbCoverage},null,2)+'\n');
try { await readFile(path.join(root, 'dist/data/publication.json')); }
catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(root, 'dist/data/publication.json'), JSON.stringify({ author: 'novacanenumb', repositoryUrl: null, siteUrl: null, profileLinkStatus: 'UNAVAILABLE' }, null, 2) + '\n'); }
const archiveReceipt=JSON.parse(await readFile(path.join(root,'experiments/native-archive/test-receipt.json'),'utf8'));
const archiveCoverage=JSON.parse(await readFile(path.join(root,'experiments/native-archive/coverage.json'),'utf8'));
const archiveSummary=JSON.parse(await readFile(path.join(root,'experiments/native-archive/summary.json'),'utf8'));
await writeFile(path.join(root,'dist/data/native-archive-evidence.json'),JSON.stringify({...archiveReceipt,coverage:archiveCoverage,summary:archiveSummary},null,2)+'\n');
await copyFile(path.join(root,'experiments/native-archive/results.json'),path.join(root,'dist/data/native-archive-results.json'));
run('scripts/benchmark.mjs');
console.log('Static dossier built in dist; no provider calls.');
