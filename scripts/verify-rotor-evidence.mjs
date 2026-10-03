import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { stableJSON } from '../packages/lab/core.mjs';
export async function verifyRotorEvidence(root) {
  const read=f=>readFile(path.join(root,f)),json=async f=>JSON.parse(await read(f)),hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
  const receipt=await json('experiments/rotor/test-receipt.json'),manifest=await json('experiments/rotor/source-manifest.json');
  assert.equal(receipt.status,'PASSED');assert.equal(receipt.sourceUnchanged,true);assert.equal(receipt.temporaryCopyRemoved,true);
  assert.deepEqual(receipt.originalTests,{total:9,passed:9});assert.deepEqual(receipt.additionalTests,{total:6,passed:6});
  assert.equal(receipt.tests.collected,15);assert.equal(receipt.tests.passed,15);for(const key of ['failed','errors','skipped'])assert.equal(receipt.tests[key],0);
  assert.equal(receipt.tests.results.length,15);assert.ok(receipt.tests.results.every(t=>t.status==='PASSED'));
  assert.equal(receipt.execution.pytestExitCode,0);assert.equal(receipt.execution.exitCode,0);assert.equal(receipt.execution.libraries.pytest,'9.1.1');assert.match(receipt.execution.pythonVersion,/^3\.12\./);
  assert.equal(manifest.files.length,7);assert.equal(new Set(manifest.files.map(f=>f.path)).size,7);assert.deepEqual(receipt.sourceFiles,manifest.files);assert.deepEqual(receipt.sourceMetadata,manifest.metadata);
  assert.equal(receipt.sourceManifestHash,hash(await read('experiments/rotor/source-manifest.json')));
  for(const [file,digest]of Object.entries(receipt.sourceHashes))assert.equal(hash(await read(file)),digest,'Stale rotor source receipt: '+file);
  assert.equal(receipt.hypervisorDependency.version,'2.1.0');assert.equal(receipt.hypervisorDependency.verifiedFiles,85);
  assert.equal(receipt.hypervisorDependency.manifestHash,'sha256:31add3a0cd6d6ee09a98a1bce2b32289e2e20673739df466cee7aa91d263da2c');
  assert.equal(receipt.protocol.hashBefore,receipt.protocol.hashAfter);assert.equal(receipt.protocol.hashBefore,hash(await read(receipt.protocol.path)));
  const protocol=await json(receipt.protocol.path);assert.deepEqual(receipt.protocol.parsed,protocol);
  const traceBytes=await read(receipt.traceFile.path),trace=JSON.parse(traceBytes);assert.equal(traceBytes.length,receipt.traceFile.bytes);assert.equal(hash(traceBytes),receipt.traceFile.hash);assert.deepEqual(trace.protocol,protocol);
  assert.deepEqual(trace.denominator,{cases:4,requestedRouteCalls:8,recordedRouteCalls:8,failedRouteCalls:0,excludedCases:0});assert.equal(trace.cases.length,4);
  for(const [i,c]of trace.cases.entries()){
    assert.equal(c.tokenTime,protocol.times[i]);assert.equal(c.publicInput.token_time,c.tokenTime);assert.equal(c.replayEqual,true);assert.equal(c.inputUnchanged,true);assert.equal(c.traceHash,c.replayTraceHash);assert.deepEqual(c.failures,[]);
    const {canonicalJsonBytes,...body}=c;assert.equal(Buffer.byteLength(stableJSON(body),'utf8'),canonicalJsonBytes);
    const required=c.publicInput.records.filter(r=>c.tokenTime-r.token_time>=1&&c.tokenTime-r.token_time<=8),delivered=c.result.arrivals.filter(a=>a.route_classes.includes('LOCAL_WINDOW'));
    assert.equal(c.requiredLocalCount,required.length);assert.equal(c.deliveredLocalCount,delivered.length);assert.deepEqual(delivered.map(a=>a.record_hash).sort(),required.map(r=>r.record_hash).sort());assert.equal(c.routeCount,c.result.arrivals.length);
    assert.equal(c.result.rays.length,3);assert.ok(c.result.rays.every(r=>r.cells.length<=8));assert.ok(c.publicInput.records.length<=16);
    for(const a of c.result.arrivals){assert.ok(c.publicInput.records.some(r=>r.record_hash===a.record_hash));assert.ok(a.token_time<c.tokenTime);assert.equal(a.arrival_ceiling,Math.min(a.resonance,a.recency_support));assert.ok(Number.isInteger(a.arrival_ceiling)&&a.arrival_ceiling>=0&&a.arrival_ceiling<=16777215);}
  }
  assert.equal(trace.providerCalls,0);assert.equal(receipt.provenance.providerCalls,0);
  for(const field of ['hostedTokens','billedCost','hostedLatencyMs','modelQuality','defaultModelBaseline','cameraIsolation','crossSequenceIsolation','trainingOrCheckpointBehavior'])assert.equal(trace[field],null);
  assert.equal(receipt.controls.auditHook,'BEST_EFFORT');assert.equal(receipt.controls.operatingSystemConfinement,'UNAVAILABLE');assert.equal(receipt.provenance.sourceCodeRedistributed,false);
  const coverage=await json('experiments/rotor/coverage.json');assert.deepEqual(coverage.acceptanceIds,['C24-T01','C24-T03']);assert.deepEqual(coverage.unverifiedAcceptanceIds,['C24-T02','C24-T04']);
  assert.deepEqual(await json('dist/data/rotor-evidence.json'),{...receipt,coverage});assert.equal(hash(await read('dist/data/rotor-trace.json')),hash(traceBytes));
  const native=await json('experiments/rotor/native/receipt.json'),text=(await read('experiments/rotor/native/validated-source.txt')).toString('utf8').slice(0,native.sourceCharacters);
  assert.equal(hash(JSON.stringify(text)),native.sourceTextHash);assert.equal(native.completionState,'REPORTED');assert.equal(native.persisted,false);
  let files=0;for(const match of text.matchAll(/```\n([\s\S]*?)\n```/g)){const node=JSON.parse(match[1]);assert.ok(['docs/ROTOR_EVIDENCE.md','experiments/rotor/probe.py'].includes(node.path));assert.equal((await read(node.path)).toString('utf8'),node.content);files++;}assert.equal(files,2);
  assert.equal((await json('experiments/rotor/native/manifest.json')).final_artifact_hash,native.artifactHash);assert.equal((await json('experiments/rotor/native/performance.json')).gtfl.collapse_validity,'VALID');
  const failure=await json('experiments/rotor/history/native-timeout.json');assert.equal(failure.code,'TASK_TIMEOUT');assert.equal(failure.state,'FAILED');assert.equal(failure.candidateSubmissions,0);assert.equal(failure.runId,native.supersededFailedRunId);
  const preflight=await json('experiments/rotor/history/dependency-preflight.json');assert.equal(preflight.status,'FAILED');assert.equal(preflight.pythonExecutions,0);assert.equal(preflight.lockUnchanged,true);assert.notEqual(preflight.expectedHash,preflight.observedHash);
  return {rotorOriginalTests:9,rotorAdditionalProbes:6,rotorRouteCalls:8,rotorCases:4,rotorSourceFiles:7,rotorPartialAcceptanceIds:coverage.acceptanceIds,rotorSourceUnchanged:true,rotorNativeSourceMatches:2,rotorByteAccountingRecomputed:true,rotorCanonicalCborRecomputation:'UNAVAILABLE in portable verifier; original Python execution and whole-file binding retained'};
}
