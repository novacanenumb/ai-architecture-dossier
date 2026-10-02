import test from 'node:test';
import assert from 'node:assert/strict';
import { ExactArchive, createSyntheticHistory, rankLexical, runComparison, stableJSON, sha256 } from '../packages/lab/core.mjs';
const bytes = value => Buffer.byteLength(value, 'utf8');
test('stable JSON sorts recursive keys, preserves array order; SHA256 known vector', async () => {
  assert.equal(stableJSON({z:1,a:{y:2,b:3},list:[{z:1,a:2}]}), '{"a":{"b":3,"y":2},"list":[{"a":2,"z":1}],"z":1}');
  assert.equal(await sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
test('archive preserves Unicode, BOM, null byte and newline exact bytes; copies cannot alter it', async () => {
  const archive = new ExactArchive(), content = '\uFEFFCafé 東京 😀\n\u0000-tail';
  const receipt = await archive.append({id:'unicode',content,metadata:{pinned:true}});
  assert.equal(receipt.version,1); assert.equal(receipt.byteLength,bytes(content));
  const m = archive.materialize({id:'unicode'});
  assert.equal(m.text,content); assert.deepEqual(Buffer.from(m.bytes),Buffer.from(content));
  m.bytes.fill(0); m.metadata.pinned = false;
  assert.equal(archive.materialize({id:'unicode'}).text,content);
  assert.equal(archive.list()[0].metadata.pinned,true);
  assert.equal(archive.export()[0].text,content);
});
test('UTF8 materialization rejects split code points, including interior empty slices', async () => {
  const archive = new ExactArchive(); await archive.append({id:'utf8',content:'A😀B'});
  for (const [startByte,endByte] of [[2,3],[2,2],[0,2]]) assert.throws(() => archive.materialize({id:'utf8',startByte,endByte}), /INVALID_UTF8_SLICE/);
  assert.equal(archive.materialize({id:'utf8',startByte:1,endByte:5}).text,'😀');
  assert.equal(archive.materialize({id:'utf8',startByte:5,endByte:5}).text,'');
  assert.throws(() => archive.materialize({id:'utf8',startByte:-1}),/startByte/);
  assert.throws(() => archive.materialize({id:'utf8',endByte:20}),/INVALID_BYTE_RANGE/);
  assert.throws(() => archive.materialize({id:'utf8',version:999}),/NOT_FOUND/);
});
test('scope authorization denies private operations and owner filtering isolates permitted scopes', async () => {
  const denied = new ExactArchive();
  await assert.rejects(denied.append({id:'secret',content:'private',scope:'private'}),/UNAUTHORIZED_SCOPE/);
  const archive = new ExactArchive({authorize:scope => ['public','private'].includes(scope)});
  await archive.append({id:'visible',content:'public',scope:'public'});
  await archive.append({id:'hidden',content:'private',scope:'private'});
  assert.deepEqual(archive.list({scope:'public'}).map(r=>r.id),['visible']);
  assert.throws(()=>archive.materialize({id:'hidden',scope:'public'}),/NOT_FOUND/);
  assert.throws(()=>archive.delete({id:'hidden',scope:'public'}),/NOT_FOUND/);
  assert.equal(archive.export({scope:'public'}).length,1);
});
test('correction preserves exact revision history and invalidates stale preconditions', async () => {
  const archive = new ExactArchive(); await archive.append({id:'fact',content:'old'});
  assert.equal((await archive.correct({id:'fact',content:'new',expectedVersion:1})).version,2);
  await assert.rejects(archive.correct({id:'fact',content:'stale',expectedVersion:1}),/STALE_REVISION/);
  assert.equal(archive.materialize({id:'fact',version:1}).text,'old');
  assert.equal(archive.materialize({id:'fact',version:2}).text,'new');
  assert.deepEqual(archive.list({includeHistory:true}).map(r=>r.version),[1,2]);
  assert.notEqual(archive.list({includeHistory:true})[0].hash,archive.list()[0].hash);
});
test('concurrent ingestion and correction reject conflicting writers', async () => {
  const archive = new ExactArchive();
  const results = await Promise.allSettled([archive.append({id:'race',content:'a'}),archive.append({id:'race',content:'b'})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const corrections = await Promise.allSettled([archive.correct({id:'race',content:'c',expectedVersion:1}),archive.correct({id:'race',content:'d',expectedVersion:1})]);
  assert.equal(corrections.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(archive.list()[0].version,2);
});
test('deletion purges all historic raw bytes and blocks resurrection', async () => {
  const archive = new ExactArchive(); await archive.append({id:'fact',content:'v1'});
  await archive.correct({id:'fact',content:'v2',expectedVersion:1});
  assert.deepEqual(archive.delete({id:'fact'}),{id:'fact',deleted:true,purgedVersions:2});
  assert.deepEqual(archive.list(),[]); assert.deepEqual(archive.export(),[]);
  for (const version of [1,2]) assert.throws(()=>archive.materialize({id:'fact',version}),/DELETED/);
  await assert.rejects(archive.correct({id:'fact',content:'v3'}),/DELETED/);
  await assert.rejects(archive.append({id:'fact',content:'resurrect'}),/SOURCE_ALREADY_EXISTS/);
});
test('synthetic fixtures are deterministic, public-safe and explicitly source linked', () => {
  for (const size of [4,8,64]) {
    const history = createSyntheticHistory({size}); assert.deepEqual(history,createSyntheticHistory({size}));
    assert.equal(history.length,2*size+1); assert.ok(history.every(r=>r.scope==='public'&&r.metadata.synthetic));
    assert.equal(history.filter(r=>r.required).length,Math.min(8,Math.ceil(size/8)));
    assert.ok(history.filter(r=>r.required).every(r=>r.text.includes(r.exactSpan)&&r.sourceId));
  }
});
test('lexical rank uses Unicode overlap, deterministic ties, and defensive copies', () => {
  const records = [{id:'b',text:'Café 東京 alpha'},{id:'a',text:'Café 東京 alpha'},{id:'0',text:'alpha only'}];
  const first=rankLexical('CAFÉ 東京',records), second=rankLexical('CAFÉ 東京',[...records].reverse());
  assert.deepEqual(first,second); assert.deepEqual(first.map(r=>r.id),['a','b','0']);
  first[0].text='changed'; assert.equal(records[1].text,'Café 東京 alpha');
});
test('five comparison arms replay exactly; bytes include full serialization and duplicated inputs', async () => {
  for (const historySize of [4,8,64]) {
    const config={historySize,budgetBytes:65536,recentCount:8,retrievalLimit:8,workers:3};
    const first=await runComparison(config); assert.equal(stableJSON(first),stableJSON(await runComparison(config)));
    assert.equal(first.provenance.providerCalls,0);
    assert.deepEqual(Object.keys(first.arms),['full','recent','retrieval','sparse','combined']);
    for (const [name,arm] of Object.entries(first.arms)) {
      assert.equal(arm.status,'READY'); assert.equal(arm.noDispatch,false); assert.equal(arm.bytes,arm.measuredBytes);
      if (name!=='combined') assert.equal(arm.bytes,bytes(stableJSON(arm.packet)));
      for (const field of ['inputTokens','cost','modelLatencyMs','taskQuality']) assert.equal(arm[field],null);
      assert.ok(arm.recall.every(r=>typeof r.recalled==='boolean'&&r.sourceId));
    }
    const combined=first.arms.combined, packet=combined.packet;
    const work=packet.workerPackets.reduce((s,w)=>s+bytes(stableJSON(w.packet)),0);
    assert.equal(packet.accounting.workerSerializedBytes,work);
    assert.equal(packet.accounting.routingOverheadBytes,bytes(stableJSON(packet.route)));
    assert.equal(combined.bytes,bytes(stableJSON(packet.route))+work);
    assert.equal(first.arms.full.exactFactRecall,1); assert.equal(first.arms.sparse.exactFactRecall,1); assert.equal(combined.exactFactRecall,1);
    assert.ok(packet.workerPackets.every(w=>w.packet.items.some(r=>r.id==='pin-policy')));
  }
});
test('pinned and required facts remain atomic; overflow cannot count as efficiency', async () => {
  const result=await runComparison({historySize:64,budgetBytes:1,workers:4});
  for (const name of ['sparse','combined']) { const arm=result.arms[name]; assert.equal(arm.status,'PINNED_OVERFLOW'); assert.equal(arm.noDispatch,true); assert.equal(arm.exactFactRecall,0); assert.ok(arm.recall.every(r=>!r.recalled)); }
  assert.equal(result.arms.sparse.bytes,0); assert.equal(result.arms.sparse.packet,null); assert.ok(result.arms.sparse.requiredBytes>1);
  assert.equal(result.arms.combined.bytes,result.arms.combined.packet.accounting.routingOverheadBytes);
});
test('required unauthorized, missing or deleted sources fail closed; permitted packets omit private sources', async () => {
  const history=createSyntheticHistory({size:8}), required=history.find(r=>r.required);
  await assert.rejects(runComparison({history,permission:r=>r.id!==required.id}),/MISSING_OR_UNAUTHORIZED_EXACT_SOURCE/);
  await assert.rejects(runComparison({history:history.filter(r=>r.id!==required.id),requiredFactIds:[required.id]}),/MISSING_OR_UNAUTHORIZED_EXACT_SOURCE/);
  await assert.rejects(runComparison({history:history.map(r=>r.id===required.id?{...r,deleted:true}:r)}),/MISSING_OR_UNAUTHORIZED_EXACT_SOURCE/);
  const result=await runComparison({history:[...history,{id:'private',scope:'private',text:'do not export'}]});
  assert.ok(!stableJSON(result).includes('do not export'));
});
test('navigation bridge cannot replace missing exact source; zero recent/retrieval preserves declared emptiness', async () => {
  const result=await runComparison({historySize:8,budgetBytes:65536,recentCount:0,retrievalLimit:0});
  assert.equal(result.arms.recent.packet.items.length,0); assert.equal(result.arms.retrieval.packet.items.length,0);
  assert.equal(result.arms.recent.exactFactRecall,0); assert.equal(result.arms.sparse.exactFactRecall,1);
  assert.equal(result.arms.sparse.packet.header.bridge,'Navigation only, never exact evidence.');
  const required=createSyntheticHistory({size:8}).find(r=>r.required);
  const altered=createSyntheticHistory({size:8}).map(r=>r.id===required.id?{...r,text:'Synthetic bridge summary only'}:r);
  assert.equal((await runComparison({history:altered})).arms.sparse.exactFactRecall,0);
});
