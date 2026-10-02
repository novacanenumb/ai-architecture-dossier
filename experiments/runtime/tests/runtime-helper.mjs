import assert from 'node:assert/strict';
import { readFile, readdir, lstat, realpath } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const approvedDependency = Object.freeze({
  version: '2.1.0',
  manifestHash: 'sha256:31add3a0cd6d6ee09a98a1bce2b32289e2e20673739df466cee7aa91d263da2c',
  contentRoot: 'sha256:ca9b10af213bfd69bd8f8e2994eef6e2a6313f91ccd2f9bcca5c6cddee39e0c1'
});
const digest = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
let verification;
export async function verifyRuntime() {
  return verification ??= (async () => {
    assert.ok(Number(process.versions.node.split('.')[0]) >= 26, 'Supplied runtime probes require Node 26 or later');
    const configured = process.env.DOSSIER_RUNTIME_PATH;
    const target = path.resolve(configured || path.join(import.meta.dirname, '../../../../HYPERVISOR-2.1-STABLE'));
    const root = await realpath(target).catch(() => { throw new Error('RUNTIME_UNAVAILABLE: set DOSSIER_RUNTIME_PATH to the separately licensed 2.1.0 dependency'); });
    let at = path.parse(target).root;
    for (const part of target.slice(at.length).split(path.sep).filter(Boolean)) {
      at = path.join(at, part);
      assert.equal((await lstat(at)).isSymbolicLink(), false, 'Runtime path must not traverse links');
    }
    const manifestBytes = await readFile(path.join(root, 'PACKAGE_MANIFEST.json'));
    assert.equal(digest(manifestBytes), approvedDependency.manifestHash, 'Unapproved runtime manifest');
    const manifest = JSON.parse(manifestBytes);
    assert.equal(manifest.version, approvedDependency.version);
    assert.equal(manifest.packageKind, 'project_dependency');
    assert.equal(manifest.contentRoot, approvedDependency.contentRoot);
    assert.equal(digest(Buffer.from(JSON.stringify(manifest.files))), approvedDependency.contentRoot);
    const names = [];
    async function walk(directory, prefix = '') {
      for (const entry of await readdir(directory, { withFileTypes: true })) {
        const file = prefix + entry.name, stat = await lstat(path.join(directory, entry.name));
        assert.equal(stat.isSymbolicLink(), false, 'Runtime links are not permitted');
        if (stat.isDirectory()) await walk(path.join(directory, entry.name), file + '/');
        else { assert.equal(stat.isFile(), true); names.push(file); }
      }
    }
    await walk(root);
    assert.deepEqual(names.filter(n => n !== 'PACKAGE_MANIFEST.json').sort(), manifest.files.map(f => f.path).sort(), 'Runtime file set differs');
    const sourceHashes = {};
    for (const file of manifest.files) {
      assert.ok(typeof file.path === 'string' && !file.path.includes('\\') && !file.path.includes(':') && file.path.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe runtime member');
      const bytes = await readFile(path.join(root, ...file.path.split('/')));
      assert.equal(bytes.length, file.size, 'Runtime size differs: ' + file.path);
      assert.equal(digest(bytes), file.hash, 'Runtime hash differs: ' + file.path);
      sourceHashes[file.path] = file.hash;
    }
    return { root, version: manifest.version, manifestHash: digest(manifestBytes), contentRoot: manifest.contentRoot, verifiedFiles: manifest.files.length, sourceHashes };
  })();
}

export async function runtimeModule(relative) {
  assert.ok(typeof relative === 'string' && !relative.includes('\\') && !relative.includes(':') && relative.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe runtime import');
  const verified = await verifyRuntime();
  const member = 'plugins/hypervisor-standalone/runtime/' + relative;
  assert.ok(Object.hasOwn(verified.sourceHashes, member), 'Runtime import must be a verified manifest member');
  const source = path.join(verified.root, ...member.split('/'));
  assert.equal(digest(await readFile(source)), verified.sourceHashes[member], 'Runtime changed after verification');
  return import(pathToFileURL(source).href);
}
