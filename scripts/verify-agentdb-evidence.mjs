import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pairedBootstrap} from '../packages/lab/analytics.mjs';

export async function verifyAgentdbEvidence(root,catalog,runtimeReceipt) {
  const bytes=file=>readFile(path.join(root,file));
  const json=async file=>JSON.parse(await bytes(file));
  const digest=data=>'sha256:'+createHash('sha256').update(data).digest('hex');
  const near=(actual,expected)=>assert.ok(Number.isFinite(actual)&&Math.abs(actual-expected)<1e-12,'Recorded arithmetic differs');
  const mean=values=>values.reduce((sum,value)=>sum+value,0)/values.length;
  const r=await json('experiments/agentdb/test-receipt.json'), manifest=await json('experiments/agentdb/source-manifest.json'), coverage=await json('experiments/agentdb/coverage.json');
  assert.equal(r.status,'PASSED'); assert.equal(r.sourceUnchanged,true); assert.equal(r.execution.exitCode,0); assert.equal(r.execution.pytestExitCode,0); assert.equal(r.execution.error,null); assert.equal(r.executionError,null);
  assert.match(r.execution.pythonVersion,/^3\.12\.0 /); assert.deepEqual(r.execution.libraries,{cryptography:'50.0.1',pydantic:'2.13.5',pytest:'9.1.1',rfc8785:'0.1.4'});
  assert.equal(r.sourcePackage.canonicalComponent,'hypervisor.agent_database'); assert.equal(r.sourcePackage.sourceRedistributed,false);
  assert.equal(r.hypervisorDependency.version,'2.1.0'); assert.equal(r.hypervisorDependency.manifestHash,runtimeReceipt.dependency.manifestHash); assert.equal(r.hypervisorDependency.contentRoot,runtimeReceipt.dependency.contentRoot);
  assert.equal(manifest.files.length,19); assert.equal(new Set(manifest.files.map(f=>f.path)).size,19); assert.deepEqual(r.sourceFiles,manifest.files); assert.equal(r.sourceManifestHash,digest(await bytes('experiments/agentdb/source-manifest.json')));
  for(const f of manifest.files){assert.ok(/^(?:orpheus_agents\/[^.\/]+\.py|orpheus_agents\/migrations\/\d+_[a-z_]+\.sql|tests\/test_(?:collections|governance|signing)\.py|pyproject\.toml)$/.test(f.path)); assert.ok(f.bytes>0); assert.match(f.hash,/^sha256:[a-f0-9]{64}$/);}
  for(const [file,hash] of Object.entries(r.sourceHashes)) assert.equal(digest(await bytes(file)),hash,'Stale Agent Database source '+file);
  assert.equal(r.tests.collected,39); assert.equal(r.tests.passed,39); assert.equal(r.tests.failed,0); assert.equal(r.tests.skipped,0); assert.equal(r.tests.errors,0); assert.deepEqual(r.tests.collectionErrors,[]);
  assert.equal(r.tests.results.length,39); assert.equal(new Set(r.tests.results.map(t=>t.id)).size,39);
  for(const test of r.tests.results){assert.match(test.id,/^tests\/test_(?:collections|governance|signing)\.py::test_/); assert.equal(test.status,'PASSED'); assert.deepEqual(test.phases.map(p=>p.phase),['setup','call','teardown']); assert.ok(test.phases.every(p=>p.status==='PASSED'));}
  assert.deepEqual(r.probe.summary,{failed:0,passed:10,total:10}); assert.equal(r.probe.cases.length,10); assert.ok(r.probe.cases.every(c=>c.status==='PASSED'));
  assert.equal(coverage.fullComponentAcceptance,false); assert.equal(coverage.status,'PARTIAL_ORIGINAL_SOURCE_EVIDENCE'); assert.deepEqual(coverage.components.map(c=>c.componentId),['C05','C17','C18','C20']);
  for(const item of coverage.components){const component=catalog.components.find(c=>c.id===item.componentId); assert.ok(component); assert.ok(item.acceptanceIds.every(id=>component.acceptance.some(a=>a.id===id))); assert.ok(item.boundary);}
  for(const probe of r.probe.cases) for(const id of probe.acceptanceIds) assert.ok(coverage.components.some(c=>c.acceptanceIds.includes(id)));
  const signature=r.probe.cases.find(c=>c.detail.changedField); assert.equal(signature.detail.changedField,'terms.retention_days'); assert.equal(signature.detail.originalSignaturesVerified,2); assert.equal(signature.detail.changedTermSignaturesRejected,2); assert.equal(signature.detail.independentKeyCustody,false); assert.equal(signature.detail.privateKeysExported,false); assert.equal(signature.detail.signaturesExported,false);
  const bootstrap=r.probe.cases.find(c=>c.detail.frozenClockRepeatable); assert.equal(bootstrap.detail.activeAgreementPresent,false); assert.equal(bootstrap.detail.qualificationCount,0); assert.equal(bootstrap.detail.clockChangeSeconds,60); assert.equal(bootstrap.detail.expiryChangeSeconds,60);
  assert.equal(r.controls.auditHook,'BEST_EFFORT'); assert.equal(r.controls.operatingSystemConfinement,'UNAVAILABLE'); assert.equal(r.controls.originalWrites,false); assert.equal(r.controls.realWorkers,false); assert.equal(r.controls.pytestPluginAutoload,false);
  assert.equal(r.provenance.providerCalls,0); assert.equal(r.provenance.sourceCodeRedistributed,false); for(const field of ['hostedTokens','billedCost','hostedLatencyMs','modelQuality']) assert.equal(r.provenance[field],null);
  const b=r.probe.benchmark, protocol=await json('experiments/agentdb/cache-protocol.json');
  assert.deepEqual(b.protocol,protocol); assert.equal(b.protocolHashBefore,digest(await bytes('experiments/agentdb/cache-protocol.json'))); assert.equal(b.protocolHashAfter,b.protocolHashBefore);
  assert.equal(protocol.pairs,8); assert.equal(protocol.queriesPerArm,16); assert.equal(protocol.syntheticDocuments,32); assert.equal(protocol.limits.operatingSystemColdCache,false); assert.equal(protocol.limits.defaultModelComparison,false);
  assert.equal(b.attempts.length,16); assert.equal(b.pairs.length,8); assert.equal(new Set(b.attempts.map(a=>a.pairIndex+':'+a.arm)).size,16);
  let requested=0,recorded=0,failed=0,undispatched=0,priming=0;
  for(const attempt of b.attempts){
    assert.ok(['baseline','candidate'].includes(attempt.arm)); assert.equal(attempt.status,'fulfilled'); assert.equal(attempt.error,null); assert.equal(attempt.providerCalls,0);
    for(const field of ['billedCost','modelQuality','modelTokens']) assert.equal(attempt[field],null);
    assert.equal(attempt.requestedQueries,16); assert.equal(attempt.recordedQueries,attempt.queries.length); assert.equal(attempt.queries.length,16); assert.equal(attempt.failedQueries,0); assert.equal(attempt.notDispatchedQueries,0);
    assert.equal(attempt.orderInPair,attempt.pairIndex%2===0?(attempt.arm==='baseline'?0:1):(attempt.arm==='candidate'?0:1));
    for(const [i,query] of attempt.queries.entries()){assert.equal(query.queryIndex,i); assert.equal(query.status,'fulfilled'); assert.ok(Number.isFinite(query.durationMs)&&query.durationMs>=0); assert.equal(query.rowCount,10); assert.equal(query.resultHash,attempt.resultHash);}
    near(attempt.meanQueryMs,mean(attempt.queries.map(q=>q.durationMs)));
    assert.equal(attempt.cacheHitsDelta,attempt.arm==='baseline'?0:16); assert.equal(attempt.internalLatencySamplesDelta,attempt.arm==='baseline'?16:1);
    assert.equal(attempt.primingCalls.length,attempt.arm==='baseline'?0:1);
    for(const prime of attempt.primingCalls){assert.equal(prime.status,'fulfilled'); assert.ok(Number.isFinite(prime.durationMs)&&prime.durationMs>=0); assert.equal(prime.resultHash,attempt.resultHash); assert.equal(prime.rowCount,10);}
    requested+=attempt.requestedQueries;recorded+=attempt.recordedQueries;failed+=attempt.failedQueries;undispatched+=attempt.notDispatchedQueries;priming+=attempt.primingCalls.length;
  }
  assert.deepEqual(b.denominator,{attempts:16,eligiblePairs:8,excludedPairs:0,failedAttempts:0,failedMeasuredQueries:failed,notDispatchedQueries:undispatched,pairs:8,primingCalls:priming,recordedMeasuredQueries:recorded,requestedMeasuredQueries:requested});
  assert.equal(recorded,256); assert.equal(requested,256); assert.equal(priming,8);
  for(const [i,pair] of b.pairs.entries()){
    assert.equal(pair.pairIndex,i); assert.equal(pair.eligible,true); assert.equal(pair.exclusionReason,null); assert.equal(pair.outputEqual,true);
    const baseline=b.attempts.find(a=>a.pairIndex===i&&a.arm==='baseline'),candidate=b.attempts.find(a=>a.pairIndex===i&&a.arm==='candidate');
    assert.equal(baseline.resultHash,candidate.resultHash); assert.equal(pair.baselineMeanMs,baseline.meanQueryMs); assert.equal(pair.candidateMeanMs,candidate.meanQueryMs); assert.equal(pair.candidateMinusBaselineMs,pair.candidateMeanMs-pair.baselineMeanMs);
  }
  near(b.measured.baselineMeanQueryMs,mean(b.pairs.map(p=>p.baselineMeanMs))); near(b.measured.candidateMeanQueryMs,mean(b.pairs.map(p=>p.candidateMeanMs))); near(b.measured.ratioOfPairedMeans,b.measured.baselineMeanQueryMs/b.measured.candidateMeanQueryMs);
  assert.deepEqual(b.pairedStatistic,pairedBootstrap({baseline:b.pairs.map(p=>p.baselineMeanMs),candidate:b.pairs.map(p=>p.candidateMeanMs),...protocol.bootstrap}));
  assert.equal(b.telemetry.originalWarmLatencyTelemetryAbsent,true); assert.equal(b.telemetry.setupInvalidationPrimingExcludedFromQueryTiming,true); assert.equal(b.telemetry.timingsDeterministic,false);
  assert.equal(b.modelMeasurements.providerCalls,0); for(const field of ['billedCost','hostedLatencyMs','quality','tokens']) assert.equal(b.modelMeasurements[field],null);
  assert.deepEqual(await json('dist/data/agentdb-evidence.json'),{...r,coverage});
  const native=await json('experiments/agentdb/native/receipt.json'), text=(await bytes('experiments/agentdb/native/validated-source.txt')).toString('utf8');
  assert.equal(digest(JSON.stringify(text.slice(0,native.sourceCharacters))),native.sourceTextHash); assert.equal(native.completionState,'REPORTED'); assert.equal(native.persisted,false);
  assert.equal(native.nativeCandidateContracts,2); assert.equal(native.hostProposalTurns,3); assert.match(native.hostTurnAccounting,/does not account for the extra host turn/);
  let sourceMatches=0;
  for(const match of text.matchAll(/```\n([\s\S]*?)\n```/g)){const node=JSON.parse(match[1]); assert.ok(['scripts/test-agentdb-source.mjs','experiments/agentdb/execute.py','experiments/agentdb/probe.py'].includes(node.path)); assert.equal((await bytes(node.path)).toString('utf8'),node.content);sourceMatches++;}
  assert.equal(sourceMatches,3); assert.equal((await json('experiments/agentdb/native/manifest.json')).final_artifact_hash,native.artifactHash); assert.equal((await json('experiments/agentdb/native/performance.json')).gtfl.collapse_validity,'VALID');
  for(const i of [1,2,3]){
    const prefix=`experiments/agentdb/history/attempt-${i}/`, old=await json(prefix+'test-receipt.json');
    assert.equal(old.status,i===3?'PASSED':'FAILED'); assert.equal(old.tests.collected,i===3?39:0); assert.equal(old.tests.passed,i===3?39:0); assert.equal(old.probe.summary.passed,9); assert.equal(old.sourceUnchanged,true); assert.deepEqual(old.sourceFiles,manifest.files);
    for(const [file,hash] of Object.entries(old.sourceHashes)){
      const retained=file==='scripts/test-agentdb-source.mjs'?prefix+'runner-source.txt':file==='experiments/agentdb/execute.py'?prefix+'execute-source.txt':file==='experiments/agentdb/probe.py'?'experiments/agentdb/history/attempt-3/probe-source.txt':file;
      assert.equal(digest(await bytes(retained)),hash,'Historical Agent Database source differs');
    }
  }
  assert.deepEqual((await json('experiments/agentdb/history/attempt-2/test-receipt.json')).execution.diagnosticClasses,['PermissionError','WRITE_OUTSIDE_OWNED_COPY']);
  return {agentdbOriginalTests:39,agentdbAdditionalProbes:10,agentdbComponents:4,agentdbCacheAttempts:16,agentdbMeasuredQueries:256,agentdbPrimingCalls:8,agentdbEligiblePairs:8,agentdbRetainedSetupFailures:2,agentdbSourceMatches:sourceMatches,agentdbHostProposalTurns:3,agentdbNativeContracts:2};
}
