import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const run = file => { const child = spawnSync(process.execPath, [path.join(root, file)], { cwd: root, stdio: 'inherit' }); if (child.status !== 0) throw new Error(`${file} failed`); };
run('scripts/build-catalog.mjs');
await mkdir(path.join(root, 'dist/lib'), { recursive: true });
for (const file of ['core.mjs','analytics.mjs']) await copyFile(path.join(root, 'packages/lab', file), path.join(root, 'dist/lib', file));
await copyFile(path.join(root, 'LICENSE'), path.join(root, 'dist/LICENSE.txt'));
try { await readFile(path.join(root, 'dist/data/publication.json')); }
catch (error) { if (error.code !== 'ENOENT') throw error; await writeFile(path.join(root, 'dist/data/publication.json'), JSON.stringify({ author: 'novacanenumb', repositoryUrl: null, siteUrl: null, profileLinkStatus: 'UNAVAILABLE' }, null, 2) + '\n'); }
run('scripts/benchmark.mjs');
console.log('Static dossier built in dist; no provider calls.');
