import assert from 'node:assert/strict';
import { readFile, readdir, lstat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { stableJSON } from '../packages/lab/core.mjs';
import { pairedBootstrap } from '../packages/lab/analytics.mjs';
import { verifyAgentdbEvidence } from './verify-agentdb-evidence.mjs';
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
const integration=await json('experiments/runtime/integration-receipt.json');
for(const match of text.matchAll(/```\n([\s\S]*?)\n```/g)) {
  const node=JSON.parse(match[1]); const actual=await readFile(path.join(root,node.path),'utf8');
  if(actual===node.content) nativeSourceMatches.push(node.path);
  else {
    assert.ok(['scripts/build-catalog.mjs','dist/app.mjs'].includes(node.path),'Unexpected post-validation source change');
    const change=integration.hostSourceChanges.find(c=>c.path===node.path);
    assert.ok(change,'Post-validation change has no retained integration record');
    assert.equal(hash(node.content),change.previousSourceHash);
    assert.equal(hash(actual),change.currentSourceHash);
    hostSourceChanges.push({path:node.path,reason:change.reason});
  }
}
assert.equal(nativeSourceMatches.length,6); assert.equal(hostSourceChanges.length,2);
const runtimeReceipt=await json('experiments/runtime/test-receipt.json');
assert.equal(runtimeReceipt.status,'PASSED'); assert.equal(runtimeReceipt.passed,45); assert.equal(runtimeReceipt.failed,0); assert.equal(runtimeReceipt.skipped,0); assert.equal(runtimeReceipt.tests.length,runtimeReceipt.total);
assert.equal(runtimeReceipt.dependency.version,'2.1.0'); assert.equal(runtimeReceipt.dependency.verifiedFiles,85); assert.equal(runtimeReceipt.provenance.providerCalls,0);
assert.equal(runtimeReceipt.dependency.manifestHash,'sha256:31add3a0cd6d6ee09a98a1bce2b32289e2e20673739df466cee7aa91d263da2c');
assert.equal(runtimeReceipt.dependency.contentRoot,'sha256:ca9b10af213bfd69bd8f8e2994eef6e2a6313f91ccd2f9bcca5c6cddee39e0c1');
for(const [file,digest] of Object.entries(runtimeReceipt.sourceHashes)) assert.equal('sha256:'+hash(await readFile(path.join(root,file))),digest,'Stale supplied-runtime receipt: '+file);
const runtimeCoverage=await json('experiments/runtime/coverage.json');
assert.equal(runtimeCoverage.components.length,12);
for(const item of runtimeCoverage.components) {
  const component=catalog.components.find(c=>c.id===item.componentId); assert.ok(component);
  assert.ok(item.acceptanceIds.every(id=>component.acceptance.some(a=>a.id===id)));
  assert.ok(runtimeReceipt.tests.some(t=>t.status==='PASSED'&&t.componentIds.includes(item.componentId)));
}
assert.deepEqual(await json('dist/data/runtime-evidence.json'),{...runtimeReceipt,coverage:runtimeCoverage});
const runtimeNative=await json('experiments/runtime/native/receipt.json'), runtimeText=await readFile(path.join(root,'experiments/runtime/native/validated-source.txt'),'utf8');
assert.equal(hash(JSON.stringify(runtimeText.slice(0,runtimeNative.sourceCharacters))),runtimeNative.sourceTextHash.replace('sha256:',''));
assert.equal(runtimeNative.completionState,'REPORTED'); assert.equal(runtimeNative.persisted,false);
let runtimeSourceMatches=0;
for(const match of runtimeText.matchAll(/```\n([\s\S]*?)\n```/g)) {
  const node=JSON.parse(match[1]); assert.ok(runtimeCoverage.testFiles.includes(node.path));
  assert.equal(await readFile(path.join(root,node.path),'utf8'),node.content); runtimeSourceMatches++;
}
assert.equal(runtimeSourceMatches,2);
assert.equal((await json('experiments/runtime/native/manifest.json')).final_artifact_hash,runtimeNative.artifactHash);
assert.equal((await json('experiments/runtime/native/performance.json')).gtfl.collapse_validity,'VALID');
const historical=await json('experiments/runtime/history/23-probe-release/test-receipt.json');
assert.equal(historical.passed,23);
for(const [file,digest] of Object.entries(historical.sourceHashes)) {
  const retained=file==='scripts/test-supplied-runtime.mjs'?'experiments/runtime/history/23-probe-release/runner-source.txt':file;
  assert.equal('sha256:'+hash(await readFile(path.join(root,retained))),digest,'Historical probe bytes changed');
}
const schedulerNative=await json('experiments/runtime/native-scheduler/receipt.json'), schedulerText=await readFile(path.join(root,'experiments/runtime/native-scheduler/validated-source.txt'),'utf8');
assert.equal(hash(JSON.stringify(schedulerText.slice(0,schedulerNative.sourceCharacters))),schedulerNative.sourceTextHash.replace('sha256:',''));
assert.equal(schedulerNative.completionState,'REPORTED'); assert.equal(schedulerNative.persisted,false);
let schedulerSourceMatches=0;
for(const match of schedulerText.matchAll(/```\n([\s\S]*?)\n```/g)) { const node=JSON.parse(match[1]); assert.equal(await readFile(path.join(root,node.path),'utf8'),node.content); schedulerSourceMatches++; }
assert.equal(schedulerSourceMatches,3);
assert.equal((await json('experiments/runtime/native-scheduler/manifest.json')).final_artifact_hash,schedulerNative.artifactHash);
const scheduler=await json('experiments/runtime/scheduler-results.json'), protocol=await json('experiments/runtime/scheduler-protocol.json');
assert.deepEqual(scheduler.protocol.parsed,protocol); assert.equal('sha256:'+hash(await readFile(path.join(root,scheduler.protocol.path))),scheduler.protocol.byteHashBefore); assert.equal(scheduler.protocol.byteHashBefore,scheduler.protocol.byteHashAfter);
assert.equal('sha256:'+hash(await readFile(path.join(root,scheduler.runner.path))),scheduler.runner.byteHash);
assert.equal(scheduler.denominator.recordedAttempts,16); assert.equal(scheduler.attempts.length,16); assert.equal(scheduler.pairs.length,8);
assert.equal(scheduler.denominator.failedAttempts,scheduler.attempts.filter(a=>a.status==='failed').length);
for(const attempt of scheduler.attempts) {
  assert.equal(attempt.providerCalls,0); for(const field of ['modelCost','modelTokens','providerLatencyMs','modelQuality']) assert.equal(attempt[field],null);
  assert.equal(attempt.concurrency,attempt.arm==='baseline'?1:3);
  assert.equal(attempt.orderInPair,attempt.pairIndex%2===0?(attempt.arm==='baseline'?0:1):(attempt.arm==='candidate'?0:1));
  if(attempt.status==='fulfilled') {
    assert.equal(attempt.schedulerSummary.calls,4); assert.equal(attempt.callbackIntervalsMs.length,4); assert.equal(attempt.schedulerSummary.usageTokens,null);
    assert.ok(attempt.schedulerSummary.maxSimultaneous<=attempt.concurrency);
    const intervals=new Map(attempt.callbackIntervalsMs.map(i=>[i.id,i])), memo=new Map();
    function critical(id) { if(memo.has(id)) return memo.get(id); const task=protocol.tasks.find(t=>t.id===id), interval=intervals.get(id); assert.ok(interval.end_ms>=interval.start_ms); for(const dep of task.dependencies) assert.ok(interval.start_ms>=intervals.get(dep).end_ms); const value=interval.end_ms-interval.start_ms+(task.dependencies.length?Math.max(...task.dependencies.map(critical)):0); memo.set(id,value); return value; }
    assert.ok(Math.abs(Math.max(...protocol.tasks.map(t=>critical(t.id)))-attempt.criticalPathMs)<1e-9,'Critical path arithmetic differs beyond floating-point rounding');
    const expected=Object.fromEntries(protocol.tasks.map(t=>[t.id,{id:t.id,sum:6+t.id.length}])); assert.equal('sha256:'+hash(stableJSON(expected)),attempt.outputHash);
  }
}
const eligible=scheduler.pairs.filter(p=>p.eligible); assert.equal(scheduler.denominator.eligiblePairs,eligible.length); assert.equal(scheduler.denominator.excludedPairs,8-eligible.length);
for(const pair of scheduler.pairs) { const baseline=scheduler.attempts.find(a=>a.pairIndex===pair.pairIndex&&a.arm==='baseline'), candidate=scheduler.attempts.find(a=>a.pairIndex===pair.pairIndex&&a.arm==='candidate'); assert.equal(pair.baselineWallMs,baseline.actualSchedulerWallMs); assert.equal(pair.candidateWallMs,candidate.actualSchedulerWallMs); if(pair.eligible) { assert.equal(baseline.outputHash,candidate.outputHash); assert.equal(pair.candidateMinusBaselineMs,pair.candidateWallMs-pair.baselineWallMs); } }
assert.deepEqual(scheduler.pairedStatistic.bootstrap,pairedBootstrap({baseline:eligible.map(p=>p.baselineWallMs),candidate:eligible.map(p=>p.candidateWallMs),iterations:4000,confidence:.95,seed:1729}));
assert.deepEqual(await json('dist/data/scheduler-results.json'),scheduler);
const headspace=await json('experiments/headspace/test-receipt.json'), headspaceManifest=await json('experiments/headspace/source-manifest.json');
assert.equal(headspace.status,'PASSED'); assert.equal(headspace.sourceUnchanged,true);
assert.equal(headspace.originalFixtureChecks.passed,16); assert.equal(headspace.originalFixtureChecks.failed,0);
assert.equal(headspace.originalFixtureChecks.results.length,16); assert.ok(headspace.originalFixtureChecks.results.every(r=>r.status==='PASS'));
assert.equal(headspace.originalComparisonChecks.total,17); assert.equal(headspace.originalComparisonChecks.passed,true); assert.equal(headspace.originalComparisonChecks.liveProviderVerified,false);
assert.ok(headspace.commands.every(c=>c.exitCode===0&&c.error===null));
assert.equal(headspace.hypervisorDependency.version,'2.1.0'); assert.equal(headspace.hypervisorDependency.manifestHash,runtimeReceipt.dependency.manifestHash); assert.equal(headspace.hypervisorDependency.contentRoot,runtimeReceipt.dependency.contentRoot);
assert.equal(headspaceManifest.files.length,13); assert.equal(new Set(headspaceManifest.files.map(f=>f.path)).size,13);
assert.deepEqual(headspace.sourceFiles,headspaceManifest.files); assert.equal('sha256:'+hash(await readFile(path.join(root,'experiments/headspace/source-manifest.json'))),headspace.sourceManifestHash);
for(const [file,digest] of Object.entries(headspace.sourceHashes)) assert.equal('sha256:'+hash(await readFile(path.join(root,file))),digest,'Stale Headspace probe receipt: '+file);
assert.equal(headspace.provenance.providerCalls,0); assert.equal(headspace.provenance.sourceCodeRedistributed,false);
for(const field of ['hostedTokens','billedCost','hostedLatencyMs','modelQuality']) assert.equal(headspace.provenance[field],null);
const diagnostic=headspace.diagnostic; assert.equal(diagnostic.runs.length,12);
assert.deepEqual(diagnostic.requirement.baseline,{failures:12,denominator:12,status:'FAILED_BY_REQUIREMENT'});
assert.deepEqual(diagnostic.requirement.adapted,{failures:0,denominator:12,status:'PASSED'});
for(const [i,run] of diagnostic.runs.entries()) {
  assert.equal(run.seed,2048+i); assert.equal(run.baseline.seed,run.seed); assert.equal(run.adapted.seed,run.seed);
  assert.equal(run.baseline.accepted,2); assert.equal(run.baseline.requirementPass,false); assert.equal(run.baseline.verification.valid,false);
  assert.equal(run.adapted.accepted,1); assert.equal(run.adapted.prefixVersion,1); assert.equal(run.adapted.fragmentCount,1); assert.equal(run.adapted.requirementPass,true); assert.equal(run.adapted.verification.valid,true);
}
const traceBytes=await readFile(path.join(root,headspace.publicTrace.path)), trace=JSON.parse(traceBytes);
assert.equal(traceBytes.length,headspace.publicTrace.bytes); assert.equal('sha256:'+hash(traceBytes),headspace.publicTrace.rawHash);
assert.equal('sha256:'+hash(stableJSON(trace.canonical)),headspace.publicTrace.canonicalHash);
assert.equal(trace.config.seed,4096); assert.equal(trace.config.protectedText,''); assert.equal(trace.parent,null); assert.equal(headspace.publicTrace.sourceMetadataIncluded,false);
assert.deepEqual(Object.keys(trace.canonical).sort(),['echo','ember','luna','terra','vela']);
for(const profile of Object.values(trace.canonical)) { assert.equal(profile.source_ref,'authored_fixture'); assert.equal(profile.units.length,125); }
// Independently recompute public trace bindings; original schema/behavior checks are retained separately.
let lastEvent=null, prefix='', revision=0, frameCount=0;
for(const [i,event] of trace.events.entries()) {
  const {event_hash,...body}=event; assert.equal(event.seq,i+1); assert.equal(event.previous_event_hash,lastEvent); assert.equal(hash(stableJSON(body)),event_hash); lastEvent=event_hash;
  if(event.event_type==='fragment.committed') {
    const p=event.payload; assert.equal(p.prefix_version,revision); assert.equal(p.prefix_hash,hash(prefix)); assert.equal(p.previous_prefix_hash,hash(prefix)); prefix+=p.text; revision++;
    assert.equal(p.prefix_version_after,revision); assert.equal(p.prefix_hash_after,hash(prefix));
  }
  if(event.event_type==='matrix.frame') {
    const f=event.payload; assert.equal(f.prefix_version,revision); assert.equal(f.prefix_hash,hash(prefix)); assert.equal(f.backend_logprob_available,false);
    assert.equal(f.candidates.length,125); assert.ok(f.candidates.every(c=>c.backend_logprob===null&&Number.isFinite(c.probability)&&c.probability>=0));
    assert.ok(Math.abs(f.candidates.reduce((sum,c)=>sum+c.probability,0)-1)<1e-10); frameCount++;
  }
}
assert.equal(trace.events.length,90); assert.equal(revision,5); assert.equal(frameCount,30); assert.equal(prefix,trace.transcript); assert.equal(lastEvent,headspace.publicTrace.eventRoot);
assert.equal(trace.events[0].payload.canonical_hash,headspace.publicTrace.canonicalHash.slice(7)); assert.equal(trace.events.at(-1).event_type,'session.completed');
assert.deepEqual(await json('dist/data/headspace-evidence.json'),headspace); assert.equal(hash(await readFile(path.join(root,'dist/data/headspace-trace.json'))),hash(traceBytes));
const headspaceNative=await json('experiments/headspace/native/receipt.json'), headspaceText=await readFile(path.join(root,'experiments/headspace/native/validated-source.txt'),'utf8');
assert.equal(hash(JSON.stringify(headspaceText.slice(0,headspaceNative.sourceCharacters))),headspaceNative.sourceTextHash.replace('sha256:',''));
assert.equal(headspaceNative.completionState,'REPORTED'); assert.equal(headspaceNative.persisted,false);
let headspaceSourceMatches=0;
for(const match of headspaceText.matchAll(/```\n([\s\S]*?)\n```/g)) {const node=JSON.parse(match[1]); assert.ok(['experiments/headspace/probe.mjs','packages/lab/serialized-commit.mjs','scripts/test-headspace-source.mjs'].includes(node.path)); assert.equal(await readFile(path.join(root,node.path),'utf8'),node.content); headspaceSourceMatches++;}
assert.equal(headspaceSourceMatches,3); assert.equal((await json('experiments/headspace/native/manifest.json')).final_artifact_hash,headspaceNative.artifactHash); assert.equal((await json('experiments/headspace/native/performance.json')).gtfl.collapse_validity,'VALID');
const readmeReceipt=await json('experiments/native/readme-receipt.json');
const agentdbChecks=await verifyAgentdbEvidence(root,catalog,runtimeReceipt);
const readmeArtifact=await readFile(path.join(root,'experiments/native/readme-validated-source.txt'),'utf8');
assert.equal(hash(JSON.stringify(readmeArtifact.slice(0,readmeReceipt.sourceCharacters))),readmeReceipt.sourceTextHash.replace('sha256:',''));
const readmeNode=JSON.parse(readmeArtifact.match(/^```\n([\s\S]*?)\n```/)?.[1] ?? 'null');
assert.equal(readmeNode.path,'README.md');
const currentReadme=await readFile(path.join(root,'README.md'),'utf8');
assert.equal(hash(readmeNode.content),integration.readmeChange.previousSourceHash,'Retained README precondition differs');
assert.equal(hash(currentReadme),integration.readmeChange.currentSourceHash,'README differs from checked host evidence addition');
// The original validated README artifact is retained byte-for-byte above; disclosed host expansions have their own current hash.
assert.ok(currentReadme.trim().split(/\s+/).length>3500,'README expansion is missing');
assert.ok(currentReadme.includes('12 | 12')&&currentReadme.includes('0 | 12'),'Adverse and adapted Headspace denominators must remain visible');
for(const match of currentReadme.matchAll(/\]\(([^)]+)\)/g)) if(!match[1].startsWith('http')&&!match[1].startsWith('#')) await lstat(path.join(root,match[1]));
const codeFiles=[...(await tree('packages')), ...(await tree('scripts')), ...(await tree('tests')), ...(await tree('experiments/runtime/tests')), ...(await tree('experiments/headspace')), ...(await tree('dist'))].filter(f=>f.endsWith('.mjs'));
for(const file of codeFiles) { const result=spawnSync(process.execPath,['--check',file],{cwd:root,encoding:'utf8'}); assert.equal(result.status,0,file+' '+result.stderr); }
const publicFiles=await tree('dist');
const forbiddenNames=/(?:^|\/)(?:\.env(?:\..*)?|MASTER_SPEC\.md|CODEX_START\.md|hypervisor\.dependency\.json|HYPERVISOR-2\.1-STABLE|.*\.tar(?:\.gz)?|credential.*)$/i;
const credentialPattern=/(?:sk-proj-[A-Za-z0-9_-]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
for(const file of publicFiles) { assert.ok(!forbiddenNames.test(file),file); assert.ok(!credentialPattern.test(await readFile(path.join(root,file),'utf8')),'Credential pattern found: '+file); }
const manifest=async()=>Object.fromEntries(await Promise.all((await tree('dist')).map(async f=>[f,hash(await readFile(path.join(root,f)))])));
const before=await manifest(); const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:root,encoding:'utf8'}); assert.equal(build.status,0,build.stdout+build.stderr); const after=await manifest(); assert.deepEqual(after,before,'Static rebuild differs');
const report={...agentdbChecks,schemaVersion:1,status:'PASSED',tests:receipt.passed,suppliedRuntimeTests:runtimeReceipt.passed,suppliedRuntimeComponents:runtimeCoverage.components.length,runtimeSourceMatches,schedulerSourceMatches,schedulerAttempts:scheduler.attempts.length,schedulerPairs:eligible.length,headspaceOriginalFixtureChecks:16,headspaceMockComparisonChecks:17,headspaceOriginalConcurrentFailures:12,headspaceAdaptedConcurrentFailures:0,headspaceDiagnosticPairs:12,headspaceSourceMatches,headspacePortableTraceHashVerification:true,readmeWords:currentReadme.trim().split(/\s+/).length,components:28,acceptanceRequirements:122,metricEndpoints:154,fixtureConfigurations:17,providerCalls:0,syntaxChecked:codeFiles.length,publicFiles:publicFiles.length,nativeSourceMatches,hostSourceChanges,deterministicStaticRebuild:true,publicFileHashes:after,securityCheck:'Finite filename and credential pattern checks, not a comprehensive security audit.'};
await writeFile(path.join(root,'experiments/release-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({...report,publicFileHashes:undefined}));
