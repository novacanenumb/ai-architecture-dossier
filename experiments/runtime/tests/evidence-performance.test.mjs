import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeModule } from './runtime-helper.mjs';
const { EvidenceLedger } = await runtimeModule('06_EVIDENCE_PLANE/evidence.mjs');
const { makeEnvelope, ToolBroker } = await runtimeModule('05_TOOL_AND_AUTHORITY_PLANE/broker.mjs');
const { UsageLedger, analysePerformance } = await runtimeModule('07_PERFORMANCE_PLANE/performance.mjs');
const code = (fn, expected) => assert.throws(fn, e => e.code === expected);
const event = (overrides = {}) => ({ call_id: 'call-1', run_id: 'synthetic-run', stage_id: 'stage-1', agent: { role: 'sol', instance_id: 'fixture-worker', model_id: 'fixture-model', provider: 'fixture' }, tokens: { input: 100, output: 20, cached_input: 30, cache_write: 10, retrieval: 15, synthetic_context: 5 }, timing: { total_ms: 40, first_token_ms: 12, queue_ms: 3 }, cost: { currency: 'USD', value: .01, pricing_source: 'synthetic-fixture' }, provenance: { token_counts: 'estimated', cost: 'derived', latency: 'locally_measured' }, ...overrides });

test('C21 exact line receipts support an exact claim without claiming semantic entailment', () => {
  const ledger = new EvidenceLedger();
  const source = ledger.addSource({ sourceId: 's', content: 'alpha\nbeta\ngamma' });
  const receipt = ledger.receipt({ sourceId: 's', claimId: 'c', locator: { line_start: 2, line_end: 2 }, exactText: 'beta', expectedSourceHash: source.sourceHash });
  ledger.claim({ claimId: 'c', anchorId: 'a', normalizedClaim: 'beta', receipts: [receipt.receiptId], expectedValue: 'beta' });
  const result = ledger.verifyClaim('c');
  assert.equal(result.state, 'supported');
  assert.equal(result.verificationKind, 'exact-text-match-not-general-semantic-entailment');
  assert.equal(ledger.supports(receipt.receiptId, 'c'), true);
  assert.equal(ledger.verifyAll().valid, true);
  assert.match(ledger.verifyAll().evidenceHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(Object.isFrozen(ledger.snapshot()));
});

test('C21 duplicate source content is not independent evidence and contradictions stay disputed', () => {
  const ledger = new EvidenceLedger();
  for (const sourceId of ['a','b']) ledger.addSource({ sourceId, content: 'Same exact statement' });
  const receipts = ['a','b'].map(sourceId => ledger.receipt({ sourceId, claimId: 'c', exactText: 'Same exact statement' }));
  receipts.push(ledger.receipt({ sourceId: 'b', claimId: 'c', exactText: 'Same exact statement', relationship: 'contradicts' }));
  ledger.claim({ claimId: 'c', anchorId: 'anchor', normalizedClaim: 'Same exact statement', receipts: receipts.map(r => r.receiptId) });
  const result = ledger.verifyClaim('c');
  assert.equal(result.state, 'disputed');
  assert.equal(result.independentSourceCount, 1);
  assert.equal(ledger.verifyAll().valid, false);
});

test('C21 synthetic sources, stale hashes, invalid line ranges and absent exact facts are rejected', () => {
  const ledger = new EvidenceLedger();
  ledger.addSource({ sourceId: 'synthetic', content: 'Summary', kind: 'synthetic' });
  code(() => ledger.receipt({ sourceId: 'synthetic', claimId: 'c', exactText: 'Summary' }), 'SYNTHETIC_IS_NOT_EVIDENCE');
  ledger.addSource({ sourceId: 'exact', content: 'line one\nline two' });
  code(() => ledger.receipt({ sourceId: 'exact', claimId: 'c', expectedSourceHash: 'stale' }), 'SOURCE_HASH_MISMATCH');
  code(() => ledger.receipt({ sourceId: 'exact', claimId: 'c', locator: { line_start: 0, line_end: 1 } }), 'INVALID_LOCATOR');
  code(() => ledger.receipt({ sourceId: 'exact', claimId: 'c', locator: { line_start: 1, line_end: 3 } }), 'LOCATOR_OUT_OF_BOUNDS');
  code(() => ledger.receipt({ sourceId: 'exact', claimId: 'c', exactText: 'Unseen paraphrase' }), 'EXACT_FACT_NOT_FOUND');
  code(() => ledger.addSource({ sourceId: 'exact', content: 'Changed source' }), 'SOURCE_IMMUTABLE');
});

test('C21 context-only receipts and mismatched expected values do not resolve material claims', () => {
  const ledger = new EvidenceLedger(); ledger.addSource({ sourceId: 's', content: '41' });
  const receipt = ledger.receipt({ sourceId: 's', claimId: 'c', exactText: '41' });
  ledger.claim({ claimId: 'c', anchorId: 'a', normalizedClaim: '41', expectedValue: 42, receipts: [receipt.receiptId] });
  assert.equal(ledger.verifyClaim('c').state, 'unresolved');
  ledger.claim({ claimId: 'wrong', anchorId: 'a', normalizedClaim: '41', receipts: [receipt.receiptId] });
  code(() => ledger.verifyClaim('wrong'), 'RECEIPT_CLAIM_MISMATCH');
  const context = new EvidenceLedger(); context.addSource({ sourceId: 's', content: '41' });
  const nav = context.receipt({ sourceId: 's', claimId: 'c' });
  context.claim({ claimId: 'c', anchorId: 'a', normalizedClaim: '41', receipts: [nav.receiptId] });
  assert.equal(context.verifyClaim('c').state, 'unresolved');
});

test('C19 authority envelopes require strict attenuation and preserve expiry ceilings', () => {
  const parent = makeEnvelope({ id: 'parent', capabilities: ['write','read'], mutation: true, network: true, expiresAt: 5000 });
  const child = makeEnvelope({ id: 'child', parent, capabilities: ['read'], expiresAt: 4000 });
  assert.deepEqual(child.capabilities, ['read']);
  assert.equal(child.mutation, false); assert.equal(child.network, false);
  assert.match(child.envelopeHash, /^sha256:[a-f0-9]{64}$/);
  assert.ok(child.parentHash);
  code(() => makeEnvelope({ id: 'equal', parent, capabilities: ['read','write'], mutation: true, network: true, expiresAt: 5000 }), 'CHILD_AUTHORITY_NOT_STRICT_SUBSET');
  code(() => makeEnvelope({ id: 'escalated', parent, capabilities: ['admin'], expiresAt: 4000 }), 'AUTHORITY_ESCALATION');
  code(() => makeEnvelope({ id: 'late', parent, capabilities: ['read'], expiresAt: 6000 }), 'AUTHORITY_EXPIRY_ESCALATION');
});

test('C19 pure authorized tools receive frozen defensive inputs and return a bound receipt', async () => {
  const broker = new ToolBroker({ envelope: makeEnvelope({ id: 'pure', capabilities: ['read'] }), gateway: {} });
  let observed;
  broker.register('inspect', { capability: 'read', validate: args => assert.equal(args.value, 7), execute: args => { observed = args; return { value: args.value }; } });
  const args = { value: 7 }, response = await broker.call({ tool: 'inspect', args });
  args.value = 99;
  assert.ok(Object.isFrozen(observed)); assert.equal(observed.value, 7);
  assert.deepEqual(response.result, { value: 7 });
  assert.match(response.receipt.actionHash, /^sha256:[a-f0-9]{64}$/);
});

test('C19 missing capabilities, disabled effects and cancellation never execute a tool', async () => {
  let executions = 0; const decisions = [];
  const broker = new ToolBroker({ envelope: makeEnvelope({ id: 'limited', capabilities: ['read','change','connect'] }), gateway: { consume: () => { throw new Error('Must not reach approval'); } }, recordDecision: d => decisions.push(d) });
  for (const [name,capability,effects] of [['admin','admin',[]],['mutation','change',['mutation']],['network','connect',['network']],['pure','read',[]]]) broker.register(name, { capability, effects, validate: () => {}, execute: () => { executions++; throw new Error('Must not execute'); } });
  for (const [tool,expected] of [['missing','CAPABILITY_DENIED'],['admin','CAPABILITY_DENIED'],['mutation','MUTATION_DISABLED'],['network','NETWORK_DISABLED']]) await assert.rejects(broker.call({ tool, args: {} }), e => e.code === expected);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(broker.call({ tool: 'pure', args: {} }, {}, { signal: controller.signal }), e => e.code === 'CANCELED');
  assert.equal(executions, 0);
  assert.equal(decisions.length, 4);
  assert.ok(decisions.every(d => d.state === 'DENIED'));
});

test('C27 ledger totals keep cache subsets separate and reject duplicate calls', () => {
  const input = event(), ledger = new UsageLedger([input]); input.tokens.input = 999;
  assert.equal(ledger.events()[0].tokens.input, 100);
  assert.ok(Object.isFrozen(ledger.events()[0]));
  code(() => ledger.add(event()), 'DUPLICATE_USAGE_EVENT');
  const report = analysePerformance({ run_id: 'synthetic-run', usageEvents: ledger.events(), context: { final_response_tokens: 20 } });
  assert.equal(report.usage.input, 100); assert.equal(report.usage.output, 20); assert.equal(report.usage.cached_input, 30);
  assert.equal(report.cost.value, .01); assert.equal(report.metrics.TAF.value, 6);
  assert.equal(report.metrics.TAF.provenance, 'estimated');
});

test('C27 impossible usage, provenance, timing and cross-run values fail validation', () => {
  code(() => new UsageLedger([event({ provenance: { token_counts: 'unavailable', cost: 'derived', latency: 'locally_measured' } })]), 'UNAVAILABLE_HAS_TOKEN_VALUE');
  code(() => new UsageLedger([event({ cost: { currency: 'USD', value: null } })]), 'COST_PROVENANCE_MISMATCH');
  code(() => new UsageLedger([event({ tokens: { ...event().tokens, cached_input: 95 } })]), 'CACHE_EXCEEDS_INPUT');
  code(() => new UsageLedger([event({ tokens: { ...event().tokens, retrieval: 101 } })]), 'TOKEN_SUBSET_EXCEEDS_INPUT');
  code(() => new UsageLedger([event({ timing: { total_ms: 10, first_token_ms: 11, queue_ms: 0 } })]), 'TIMING_EXCEEDS_TOTAL');
  code(() => analysePerformance({ run_id: 'wrong-run', usageEvents: [event()] }), 'USAGE_RUN_MISMATCH');
});

test('C27 failed retries remain in totals and missing measurements remain null', () => {
  const report = analysePerformance({ usageEvents: [event(), event({ call_id: 'retry', stage_id: 'retry', status: 'failed', tokens: { input: 40, output: 10, cached_input: 0, cache_write: 0, retrieval: 0, synthetic_context: 0 } })], context: { final_response_tokens: 25, actual_materialized_historical_tokens: 200, estimated_dense_historical_tokens: 1000, dense_baseline_executed: false, measurement_provenance: 'locally_measured' } });
  assert.equal(report.usage.input, 140); assert.equal(report.usage.output, 30);
  assert.equal(report.metrics.TAF.value, 6.8);
  assert.equal(report.metrics.CS.value, .8); assert.equal(report.metrics.CS.provenance, 'estimated');
  const unknown = analysePerformance({ usageEvents: [event({ tokens: { input: null, output: null, cached_input: null, cache_write: null, retrieval: null, synthetic_context: null }, cost: { currency: 'USD', value: null }, provenance: { token_counts: 'unavailable', cost: 'unavailable', latency: 'locally_measured' } })] });
  assert.equal(unknown.usage.input, null); assert.equal(unknown.cost.value, null);
  assert.equal(unknown.metrics.TAF.value, null); assert.equal(unknown.metrics.CS.value, null);
  code(() => analysePerformance({ context: { accepted_material_patches: 2, proposed_review_patches: 1 } }), 'PATCH_COUNT_INVALID');
  code(() => analysePerformance({ context: { first_pass_anchors: 2, total_anchors: 1 } }), 'ANCHOR_COUNT_INVALID');
});

test('C27 fixture worker intervals yield arithmetic only with a complete consistent DAG', () => {
  const workers = [{ id: 'a', start_ms: 0, end_ms: 10 }, { id: 'b', start_ms: 0, end_ms: 20 }, { id: 'c', start_ms: 20, end_ms: 25 }];
  const dag = [{ id: 'a', dependencies: [] }, { id: 'b', dependencies: [] }, { id: 'c', dependencies: ['a','b'] }];
  const report = analysePerformance({ workers, context: { dag } });
  assert.equal(report.metrics.total_worker_execution_time.value, 35);
  assert.equal(report.metrics.observed_wall_time.value, 25);
  assert.equal(report.metrics.maximum_simultaneous_workers.value, 2);
  assert.equal(report.metrics.critical_path_duration.value, 25);
  assert.equal(report.metrics.serial_execution_estimate.provenance, 'estimated');
  assert.equal(report.metrics.speedup.value, 1.4);
  assert.equal(report.metrics.ttft_percentiles.p50.value, null);
  assert.equal(analysePerformance({ workers }).metrics.critical_path_duration.value, null);
  code(() => analysePerformance({ workers, context: { dag: dag.slice(0,2) } }), 'DAG_COVERAGE');
  code(() => analysePerformance({ workers, context: { dag: [{ id: 'a', dependencies: [] }, { id: 'b', dependencies: ['c'] }, { id: 'c', dependencies: [] }] } }), 'DAG_TIME_VIOLATION');
  code(() => analysePerformance({ workers: [workers[0],workers[0]] }), 'DUPLICATE_WORKER');
});
