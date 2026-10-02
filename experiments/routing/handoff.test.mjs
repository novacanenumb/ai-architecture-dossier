import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runtimeModule, verifyRuntime } from '../runtime/tests/runtime-helper.mjs';

const verified = await verifyRuntime();
const root = path.join(verified.root, 'plugins/hypervisor-standalone/runtime');
const { prepareTask, executePrepared, taskPacket } = await runtimeModule('01_ASTRA_CONTROL_PLANE/runtime.mjs');
const { canonical } = await runtimeModule('shared/core.mjs');
const bytes = value => Buffer.byteLength(canonical(value), 'utf8');
const logical = (prepared, anchorId) => prepared.graph.anchors.find(a => a.id === anchorId).logicalId;
function inputFixture() {
  return {
    objective: 'Exercise dependency-scoped public section handoff.',
    requirements: [{id:'r1',text:'Produce public synthetic sections.'}], profile:'FAST',
    sources: [{id:'left',content:'Public left fixture'},{id:'right',content:'Public right fixture'}],
    anchors: ['a','b','unrelated','child'].map(id => ({id,type:'section',objective:'Produce '+id,
      dependencies:id === 'child' ? ['a','b'] : [],requirementIds:['r1'],
      sourceIds:[id === 'b' || id === 'child' ? 'right' : 'left'],validators:['nonempty'],
      evidenceMode:'none',contextBudgetTokens:24000,outputBudgetTokens:2048})),
    budget:{concurrency:3,maxCalls:8,maxRounds:1,maxTokens:200000,timeoutMs:2000,totalTimeoutMs:10000}
  };
}
const prepare = input => prepareTask(input ?? inputFixture(), {root,mode:'DRY_RUN'});
function proposal(id, text = 'Public synthetic output '+id) {
  return {section:{sectionId:'section-'+id,nodes:[{nodeId:'body',type:'paragraph',text,mutability:'EXACT',claimIds:[]}],
    claimIds:[],evidenceReceiptIds:[]},claims:[],modelId:'deterministic-c04-fixture',provider:'local_fixture'};
}
async function run({prepared = null, invalidParent = false} = {}) {
  prepared ??= await prepare();
  assert.equal(prepared.state,'READY');
  const calls = [], packets = new Map();
  const result = await executePrepared(prepared,{root,persist:false,fixture:true,execute:async (task,packet) => {
    const id = logical(prepared,task.anchorId);calls.push(id);packets.set(id,packet);
    return proposal(id,invalidParent && id === 'a' ? '' : undefined);
  }});
  return {prepared,result,calls,packets};
}
const section = (execution,id) => execution.result.artifact.sections.find(s => logical(execution.prepared,s.anchorId) === id);

test('C04 child receives exactly its two validated committed parents with complete final sections', async () => {
  const e = await run();assert.equal(e.result.state,'REPORTED');assert.equal(e.result.persisted,false);
  assert.equal(e.calls.filter(id => id === 'child').length,1);
  for(const id of ['a','b'])assert.ok(e.calls.indexOf(id)<e.calls.indexOf('child'));
  const parents = e.packets.get('child').parentSections;
  assert.deepEqual(parents.map(s => logical(e.prepared,s.anchorId)).sort(),['a','b']);
  for(const parent of parents)assert.deepEqual(parent,section(e,logical(e.prepared,parent.anchorId)));
  assert.ok(parents.every(s => s.contentHash && s.nodes[0].text));
  assert.equal(parents.some(s => s.anchorId === section(e,'unrelated').anchorId),false);
});

test('C04 invalid parent output prevents child dispatch and yields no trusted artifact', async () => {
  const e = await run({invalidParent:true});assert.equal(e.result.state,'FAILED');
  assert.equal(e.result.trustedOutput,false);assert.equal(e.result.artifact,undefined);
  assert.equal(e.calls.includes('child'),false);
});

test('C04 preparation fails closed when a required source alias is absent', async () => {
  const input = inputFixture();input.anchors[0].sourceIds=['missing-source'];
  await assert.rejects(() => prepare(input),{code:'ANCHOR_SOURCE_UNAVAILABLE'});
});

test('C04 preparation rejects a declared graph dependency that does not exist', async () => {
  const input = inputFixture();input.anchors[3].dependencies=['a','absent'];
  await assert.rejects(() => prepare(input),{code:'MISSING_DEPENDENCY'});
});

test('C04 taskPacket clones and freezes caller-supplied parents without asserting commit authority', async () => {
  const prepared = await prepare(), task = prepared.plan.anchorTasks.find(t => logical(prepared,t.anchorId) === 'child');
  const supplied = [{anchorId:'public-caller-parent',nodes:[{text:'Caller supplied public content'}]}];
  const packet = taskPacket(prepared,task,supplied);supplied[0].nodes[0].text='Later mutation';supplied.push({anchorId:'late'});
  assert.equal(packet.parentSections.length,1);assert.equal(packet.parentSections[0].nodes[0].text,'Caller supplied public content');
  assert.equal(packet.parentSections[0].anchorId,'public-caller-parent');
  for(const object of [packet.parentSections,packet.parentSections[0],packet.parentSections[0].nodes,packet.parentSections[0].nodes[0]])assert.ok(Object.isFrozen(object));
});

test('C04 source IDs are mandatory aliases rather than restrictive filters in a small public archive', async () => {
  const e = await run();assert.equal(e.result.state,'REPORTED');assert.equal(e.packets.size,4);
  for(const packet of e.packets.values()) {
    const records = packet.context.exact.filter(r => r.authority === 'EXACT_SOURCE');
    assert.deepEqual(records.map(r => r.locator.uri).sort(),['source:left','source:right']);
    assert.deepEqual(records.map(r => r.content).sort(),['Public left fixture','Public right fixture']);
  }
});

test('C04 all fixture callbacks have one ledger event and complete delivered packet accounting', async () => {
  const e = await run();assert.equal(e.result.state,'REPORTED');
  const tasks = e.prepared.plan.anchorTasks, events = e.result.tokenLedger.events;
  assert.equal(tasks.length,4);assert.equal(e.calls.length,4);assert.equal(events.length,4);
  for(const task of tasks)assert.equal(events.filter(event => event.stage_id === task.id).length,1);
  for(const event of events) {
    for(const value of Object.values(event.tokens))assert.equal(value,null);
    assert.equal(event.cost.value,null);
  }
  const packets = [...e.packets].sort(([a],[b]) => a.localeCompare(b)).map(([id,packet]) => {
    const prior = id === 'child' ? e.result.artifact.sections.filter(s => logical(e.prepared,s.anchorId) !== 'child') : [];
    const broadcast = {...packet,context:{...packet.context,exact:e.prepared.archive.records},parentSections:prior};
    const sources = packet.context.exact.filter(r => r.authority === 'EXACT_SOURCE');
    return {logicalId:id,taskId:packet.taskId,actualPacketBytes:bytes(packet),constructedBroadcastPacketBytes:bytes(broadcast),
      actualParentIds:packet.parentSections.map(s => logical(e.prepared,s.anchorId)).sort(),
      constructedBroadcastParentIds:prior.map(s => logical(e.prepared,s.anchorId)).sort(),
      actualParentSectionBytes:bytes(packet.parentSections),constructedBroadcastParentSectionBytes:bytes(prior),
      deliveredSourceAliases:sources.map(r => r.locator.uri).sort(),sourceContentBytes:sources.reduce((n,r) => n+Buffer.byteLength(r.content,'utf8'),0)};
  });
  const sum = key => packets.reduce((n,p) => n+p[key],0);
  const actual = sum('actualPacketBytes'), broadcast = sum('constructedBroadcastPacketBytes');
  assert.ok(packets.every(p => p.actualPacketBytes>0 && p.constructedBroadcastPacketBytes>=p.actualPacketBytes));
  const summary = {kind:'FOUR_ROLE_PUBLIC_SYNTHETIC_PACKET_DIAGNOSTIC',baselineKind:'CONSTRUCTED_BROADCAST_PACKET',baselineExecuted:false,
    candidateExecution:'LOCAL_FIXTURE_CALLBACKS',packets,denominator:{requestedCallbacks:4,recordedCallbacks:4,ledgerEvents:4,failedCallbacks:0,omittedCallbacks:0},
    totals:{actualPacketBytes:actual,constructedBroadcastPacketBytes:broadcast,packetByteReduction:broadcast>0 ? 1-actual/broadcast : null,
      sourceContentBytes:sum('sourceContentBytes'),uniqueSourceContentBytes:39,sourceDeliveryCopies:8,sourceDuplicationCopies:6},
    dependencyRecall:{delivered:2,declared:2,ratio:1},unrelatedParentSectionsDelivered:0,privateContextLeakCount:null,
    ledger:events.map(event => ({taskId:event.stage_id,tokens:event.tokens,cost:event.cost})),
    providerCalls:0,hostedTokens:null,billedCost:null,hostedLatencyMs:null,modelQuality:null};
  assert.equal(summary.totals.sourceContentBytes,summary.totals.uniqueSourceContentBytes*4);
  console.log('C04_PACKET_ACCOUNTING '+JSON.stringify(summary));
});
