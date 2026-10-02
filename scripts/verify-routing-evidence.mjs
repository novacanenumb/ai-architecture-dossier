import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
export async function verifyRoutingEvidence(root) {
  const read = async file => JSON.parse(await readFile(path.join(root,file),'utf8'));
  const hash = value => 'sha256:'+createHash('sha256').update(value).digest('hex');
  const r = await read('experiments/routing/test-receipt.json');
  assert.equal(r.status,'PASSED');assert.equal(r.passed,7);assert.equal(r.failed,0);assert.equal(r.skipped,0);assert.equal(r.total,7);
  assert.equal(r.tests.length,7);assert.ok(r.tests.every(t => t.status==='PASSED'));
  assert.equal(r.dependency.version,'2.1.0');assert.equal(r.dependency.verifiedFiles,85);
  const original = await read('experiments/runtime/test-receipt.json');assert.deepEqual(r.dependency,original.dependency);
  for(const [file,digest] of Object.entries(r.sourceHashes))assert.equal(hash(await readFile(path.join(root,file))),digest,'Stale routing source '+file);
  for(const [file,digest] of Object.entries(r.originalModuleHashes))assert.equal(original.inspectedRuntimeSources['plugins/hypervisor-standalone/runtime/'+file] ?? (file==='shared/core.mjs' ? original.inspectedRuntimeSources['plugins/hypervisor-standalone/runtime/shared/core.mjs'] : null),digest);
  const d = r.diagnostic,p = d.packets;
  assert.equal(d.baselineKind,'CONSTRUCTED_BROADCAST_PACKET');assert.equal(d.baselineExecuted,false);
  assert.equal(d.candidateExecution,'LOCAL_FIXTURE_CALLBACKS');
  assert.deepEqual(d.denominator,{requestedCallbacks:4,recordedCallbacks:4,ledgerEvents:4,failedCallbacks:0,omittedCallbacks:0});
  assert.equal(p.length,4);assert.equal(new Set(p.map(x => x.logicalId)).size,4);
  const child = p.find(x => x.logicalId==='child');assert.deepEqual(child.actualParentIds,['a','b']);assert.deepEqual(child.constructedBroadcastParentIds,['a','b','unrelated']);
  for(const x of p){assert.deepEqual(x.deliveredSourceAliases,['source:left','source:right']);assert.equal(x.sourceContentBytes,39);assert.ok(x.constructedBroadcastPacketBytes>=x.actualPacketBytes);assert.equal(d.ledger.filter(e => e.taskId===x.taskId).length,1);}
  const actual = p.reduce((n,x) => n+x.actualPacketBytes,0),broadcast = p.reduce((n,x) => n+x.constructedBroadcastPacketBytes,0);
  assert.equal(d.totals.actualPacketBytes,actual);assert.equal(d.totals.constructedBroadcastPacketBytes,broadcast);assert.equal(d.totals.packetByteReduction,1-actual/broadcast);
  assert.equal(d.totals.sourceContentBytes,156);assert.equal(d.totals.uniqueSourceContentBytes,39);assert.equal(d.totals.sourceDuplicationCopies,6);
  assert.equal(d.privateContextLeakCount,null);assert.deepEqual(d.dependencyRecall,{delivered:2,declared:2,ratio:1});
  for(const e of d.ledger){assert.ok(Object.values(e.tokens).every(v => v===null));assert.equal(e.cost.value,null);}
  for(const value of [d,r.provenance]){assert.equal(value.providerCalls,0);for(const field of ['hostedTokens','billedCost','hostedLatencyMs','modelQuality'])assert.equal(value[field],null);}
  const catalog = await read('dist/data/catalog.json'),component = catalog.components.find(c => c.id==='C04');
  assert.ok(r.coverage.acceptanceIds.every(id => component.acceptance.some(a => a.id===id)));
  assert.deepEqual(await read('dist/data/routing-evidence.json'),r);
  const native = await read('experiments/routing/native/receipt.json'),text = await readFile(path.join(root,'experiments/routing/native/validated-source.txt'),'utf8');
  assert.equal(hash(JSON.stringify(text.slice(0,native.sourceCharacters))),native.sourceTextHash);
  assert.equal(native.completionState,'REPORTED');assert.equal(native.persisted,false);assert.equal(native.hostProposalContracts,2);assert.equal(native.actualHostProposalTurns,2);
  assert.equal(native.independentSemanticValidator,'UNAVAILABLE');
  let matches = 0;
  for(const match of text.matchAll(/```\n([\s\S]*?)\n```/g)) {const file = JSON.parse(match[1]);assert.ok(native.sourceFiles.includes(file.path));assert.equal(await readFile(path.join(root,file.path),'utf8'),file.content);matches++;}
  assert.equal(matches,2);
  assert.equal((await read('experiments/routing/native/manifest.json')).final_artifact_hash,native.artifactHash);
  const performance = await read('experiments/routing/native/performance.json');assert.equal(performance.gtfl.collapse_validity,'VALID');assert.equal(performance.usage.input,null);assert.equal(performance.cost.value,null);
  const failed = await read('experiments/routing/history/failed-1790966001292.json');assert.equal(failed.passed,4);assert.equal(failed.failed,3);assert.equal(failed.total,7);assert.equal(failed.diagnostic,null);
  for(const [file,digest] of Object.entries(failed.sourceHashes)) {
    const retained = file==='experiments/routing/handoff.test.mjs' ? 'experiments/routing/history/initial-reservation-failure/handoff-source.txt' : file==='scripts/test-routing-source.mjs' ? 'experiments/routing/history/initial-reservation-failure/runner-source.txt' : file;
    assert.equal(hash(await readFile(path.join(root,retained))),digest,'Historical routing bytes changed');
  }
  return {routingTests:7,routingDiagnosticCallbacks:4,routingBaseline:'constructed broadcast packets',originalSourcePartialComponent:'C04'};
}
