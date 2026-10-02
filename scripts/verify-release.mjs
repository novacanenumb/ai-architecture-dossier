import assert from 'node:assert/strict';
import { readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'), hash=data=>createHash('sha256').update(data).digest('hex');
const json=async file=>JSON.parse(await readFile(path.join(root,file),'utf8'));
async function tree(directory) {
  const result=[];
  for(const entry of (await readdir(path.join(root,directory))).sort()) {
    const file=path.join(directory,entry), state=await lstat(path.join(root,file));
    assert.ok(!state.isSymbolicLink(),'Publication must not follow symbolic links: '+file);
    if(state.isDirectory()) result.push(...await tree(file)); else result.push(file.replaceAll('\\','/'));
  }
  return result;
}
const catalog=await json('dist/data/catalog.json'), results=await json('dist/data/results.json'), receipt=await json('experiments/test-receipt.json');
assert.equal(catalog.components.length,28); assert.equal(catalog.components.reduce((s,c)=>s+c.acceptance.length,0),122);
assert.equal(results.metricEndpoints.length,154); assert.equal(results.coverage.length,28);
assert.equal(receipt.failed,0); assert.equal(receipt.exitCode,0); assert.ok(receipt.passed>0); assert.equal(results.tests.passed,receipt.passed);
assert.equal(results.provenance.providerCalls,0); assert.equal(results.runs.length,17);
assert.equal(results.statistics.failureRate.denominator,results.runs.length);
assert.equal(results.statistics.failureRate.numerator,results.runs.filter(r=>r.arms.combined.noDispatch).length);
assert.equal(results.statistics.bootstrap.excludedFailedPairs,1);
for(const [i,c] of catalog.components.entries()) {
  assert.equal(c.id,`C${String(i+1).padStart(2,'0')}`); assert.ok(c.purpose&&c.design&&c.claimBoundary);
  assert.deepEqual(results.coverage[i].acceptance.map(a=>a.id),c.acceptance.map(a=>a.id));
  assert.ok(results.coverage[i].acceptance.every(a=>['NOT_RUN','PARTIAL_REFERENCE_EVIDENCE'].includes(a.status)));
}
for(const metric of results.metricEndpoints) { assert.equal(metric.baseline,null); assert.equal(metric.candidate,null); }
for(const field of ['hostedTokens','billedCost','hostedLatencyMs','streamedTPS','modelQuality']) assert.equal(results.provenance[field],null);
for(const [file,digest] of Object.entries(receipt.sourceHashes)) assert.equal(hash(await readFile(path.join(root,file))),digest,'Stale test receipt '+file);
for(const file of ['core.mjs','analytics.mjs']) assert.equal(hash(await readFile(path.join(root,'dist/lib',file))),hash(await readFile(path.join(root,'packages/lab',file))));
const native=await json('experiments/native/receipt.json'), text=await readFile(path.join(root,'experiments/native/validated-source.txt'),'utf8');
// Native hash(value) binds the canonical JSON representation, including a string's quotes.
assert.equal(hash(JSON.stringify(text.slice(0,native.sourceCharacters))),native.sourceTextHash.replace('sha256:',''));
assert.equal(native.completionState,'REPORTED'); assert.equal(native.persisted,false);
const nativeSourceMatches=[], hostSourceChanges=[];
for(const match of text.matchAll(/```\n([\s\S]*?)\n```/g)) {
  const node=JSON.parse(match[1]); const actual=await readFile(path.join(root,node.path),'utf8');
  if(actual===node.content) nativeSourceMatches.push(node.path);
  else { assert.equal(node.path,'scripts/build-catalog.mjs','Unexpected post-validation source change'); hostSourceChanges.push({path:node.path,reason:'Public-registry rebuild fallback added and independently checked by host.'}); }
}
assert.equal(nativeSourceMatches.length,7); assert.equal(hostSourceChanges.length,1);
const readmeReceipt=await json('experiments/native/readme-receipt.json');
const readmeArtifact=await readFile(path.join(root,'experiments/native/readme-validated-source.txt'),'utf8');
assert.equal(hash(JSON.stringify(readmeArtifact.slice(0,readmeReceipt.sourceCharacters))),readmeReceipt.sourceTextHash.replace('sha256:',''));
const readmeNode=JSON.parse(readmeArtifact.match(/^```\n([\s\S]*?)\n```/)?.[1] ?? 'null');
assert.equal(readmeNode.path,'README.md');
assert.equal(await readFile(path.join(root,'README.md'),'utf8'),readmeNode.content,'README differs from retained proposal');
for(const match of readmeNode.content.matchAll(/\]\(([^)]+)\)/g)) if(!match[1].startsWith('http')&&!match[1].startsWith('#')) await lstat(path.join(root,match[1]));
const codeFiles=[...(await tree('packages')), ...(await tree('scripts')), ...(await tree('tests')), ...(await tree('dist'))].filter(f=>f.endsWith('.mjs'));
for(const file of codeFiles) { const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'}); assert.equal(result.status,0,file+' '+result.stderr); }
const publicFiles=await tree('dist');
const forbiddenNames=/(?:^|\/)(?:\.env(?:\..*)?|MASTER_SPEC\.md|CODEX_START\.md|hypervisor\.dependency\.json|HYPERVISOR-2\.1-STABLE|.*\.tar(?:\.gz)?|credential.*)$/i;
const credentialPattern=/(?:sk-proj-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
for(const file of publicFiles) { assert.ok(!forbiddenNames.test(file),file); assert.ok(!credentialPattern.test(await readFile(path.join(root,file),'utf8')),'Credential pattern found: '+file); }
const manifest=async()=>Object.fromEntries(await Promise.all((await tree('dist')).map(async f=>[f,hash(await readFile(path.join(root,f)))])));
const before=await manifest(); const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'}); assert.equal(build.status,0,build.stdout+build.stderr); const after=await manifest(); assert.deepEqual(after,before,'Static rebuild differs');
const report={schemaVersion:1,status:'PASSED',tests:receipt.passed,components:28,acceptanceRequirements:122,metricEndpoints:154,fixtureConfigurations:17,providerCalls:0,syntaxChecked:codeFiles.length,publicFiles:publicFiles.length,nativeSourceMatches,hostSourceChanges,deterministicStaticRebuild:true,publicFileHashes:after,securityCheck:'Finite filename and credential pattern checks, not a comprehensive security audit.'};
await writeFile(path.join(root,'experiments/release-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,publicFileHashes:undefined}));
