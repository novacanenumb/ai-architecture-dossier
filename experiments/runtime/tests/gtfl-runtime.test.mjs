import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { runtimeModule, verifyRuntime } from './runtime-helper.mjs';
const { Capsule, quantize, RESOLUTION, verifyCapsuleExport, verifyCollapseRecord } = await runtimeModule('04_GTFL_REASONING_PLANE/kernel.mjs');
const { prepareTask, executePrepared, fixtureExecutor } = await runtimeModule('01_ASTRA_CONTROL_PLANE/runtime.mjs');
const { verifyRunBundle } = await runtimeModule('shared/run-proof.mjs');
const sourceHash = c => `sha256:${c.repeat(64)}`;
const code = (fn, expected) => assert.throws(fn, { code: expected });
function capsule(id = 'capsule') {
  return new Capsule({ id, domains: [{ id: 'Result', states: ['UNRESOLVED', 'READY'], mode: 'onehot', maxActive: 1, required: true, terminalStates: ['READY'] }], collapse: { requires: [{ domain: 'Result', state: 'READY', minSupport: 1 }], requireEmptyQueue: true } });
}
function evidence(target, id = 'e', hash = sourceHash('a'), weight = 1) {
  return target.addEvidence({ id, kind: 'exact', sourceHash: hash, validator: { id: 'exact-fixture', result: 'SATISFIED' }, weight });
}
function ready(target, id = 'g1', when = []) {
  return target.schedule({ id, threshold: 0.5, when, parents: ['e'], effects: [{ domain: 'Result', state: 'READY', parents: ['e'], support: 1 }] });
}
function taskInput(profile = 'FAST') {
  return { objective: 'Synthetic public proof', requirements: [{ id: 'r1', text: 'Exact public requirement' }], profile, sources: [{ id: 'source-1', content: 'Exact public fixture claim' }], budget: { concurrency: 2, maxCalls: 8, maxRounds: 1, maxTokens: 200000, timeoutMs: 1000, totalTimeoutMs: 5000 } };
}
test('C22 quantization is deterministic and bounded', () => {
  assert.equal(RESOLUTION, 1000000); assert.equal(quantize(0.1), 100000); assert.equal(quantize(1), RESOLUTION);
  for (const value of [NaN, -.01, 1.01]) code(() => quantize(value), 'INVALID_UNIT_INTERVAL');
});
test('C22 strict collapse requires an empty queue', () => {
  code(() => new Capsule({ id: 'bad-strict', collapse: { requireEmptyQueue: false } }), 'STRICT_COLLAPSE_REQUIRES_EMPTY_QUEUE');
});
test('C22 only validated authoritative evidence can add positive support', () => {
  const c = capsule('trust');
  code(() => c.addEvidence({ id: 'x', kind: 'exact', sourceHash: sourceHash('b'), weight: 1 }), 'EVIDENCE_VALIDATOR_REQUIRED');
  code(() => c.addEvidence({ id: 'm', kind: 'model', sourceHash: sourceHash('c'), weight: .1 }), 'UNTRUSTED_EVIDENCE_SUPPORT');
  code(() => c.addEvidence({ id: 's', kind: 'synthetic', sourceHash: sourceHash('d'), weight: 0, confidence: .9 }), 'CONFIDENCE_IS_NOT_SUPPORT');
  assert.equal(c.addEvidence({ id: 'z', kind: 'synthetic', sourceHash: sourceHash('e'), weight: 0 }).support, 0);
});
test('C22 duplicate source hashes do not accumulate support', () => {
  const c = capsule('dedup'); evidence(c, 'a', sourceHash('f'), .4); evidence(c, 'b', sourceHash('f'), .4);
  c.schedule({ id: 'overstated', threshold: .1, parents: ['a','b'], effects: [{ domain: 'Result', state: 'READY', parents: ['a','b'], support: .5 }] });
  code(() => c.executeFrame(), 'UNACCOUNTED_SUPPORT_INCREASE');
});
test('C22 same-epoch gates use a frozen pre-frame state', () => {
  const c = capsule('frozen'); evidence(c); ready(c, 'set-ready'); ready(c, 'observe-ready', [{ domain: 'Result', state: 'READY', minSupport: 1 }]);
  const outcomes = new Map(c.executeFrame().decisions.map(d => [d.id,d.outcome]));
  assert.equal(outcomes.get('set-ready'), 'ACTIVATED'); assert.equal(outcomes.get('observe-ready'), 'INACTIVE');
});
test('C22 onehot overflow aborts atomically', () => {
  const c = new Capsule({ id: 'overflow', domains: [{ id: 'Choice', states: ['LEFT','RIGHT'], mode: 'onehot', maxActive: 1, required: true, terminalStates: ['LEFT','RIGHT'] }] }); evidence(c);
  for (const state of ['LEFT','RIGHT']) c.schedule({ id: `choose-${state}`, threshold: .5, parents: ['e'], effects: [{ domain: 'Choice', state, parents: ['e'], support: 1 }] });
  code(() => c.executeFrame(), 'DOMAIN_OVERFLOW'); assert.equal(c.snapshot().status, 'ABORTED'); assert.deepEqual(c.snapshot().state.Choice, []); assert.equal(c.metrics().domain_overflow_count, 1);
});
test('C22 valid collapse binds output to full leaf support', () => {
  const c = capsule('valid'); evidence(c); ready(c); c.run(); const output = { public: true }; c.bindOutput(output, { parents: ['transition:g1:0'] });
  const record = c.collapse(output); assert.equal(record.schema, 'gtfl-collapse/2'); assert.equal(record.valid, true); assert.equal(verifyCollapseRecord(record), true);
  code(() => evidence(c, 'late', sourceHash('9')), 'CAPSULE_TERMINAL');
});
test('C22 unresolved required domains cannot produce valid collapse', () => {
  const c = capsule('unresolved'); evidence(c); c.checkpoint(); const output = { public: true }; c.bindOutput(output, { parents: ['e'] });
  const record = c.collapse(output); assert.equal(record.valid, false); assert.ok(record.reasons.includes('UNRESOLVED_DOMAIN:Result'));
});
test('C28 export restores exact state and rejects tampered collapse output', () => {
  const c = capsule('replay'); evidence(c); ready(c); c.run(); const output = { public: true }; c.bindOutput(output, { parents: ['transition:g1:0'] });
  const collapse = c.collapse(output), exported = c.export(); assert.equal(verifyCapsuleExport(exported), true); assert.deepEqual(Capsule.restore(exported).export(), exported);
  const tampered = structuredClone(collapse); tampered.output.public = false; code(() => verifyCollapseRecord(tampered), 'HASH_MISMATCH');
});
test('C01 C07 C22 C28 fixture execution yields a verifiable ephemeral bundle', async () => {
  const runtime = await verifyRuntime(); assert.equal(runtime.version, '2.1.0'); const root = path.join(runtime.root, 'plugins/hypervisor-standalone/runtime');
  const prepared = await prepareTask(taskInput(), { root, mode: 'DRY_RUN' }); assert.equal(prepared.state, 'READY');
  const result = await executePrepared(prepared, { execute: fixtureExecutor(prepared), root, persist: false, fixture: true });
  assert.equal(result.state, 'REPORTED'); assert.equal(result.persisted, false); assert.equal(result.artifact.fixture, true); assert.match(result.artifact.text, /Exact public fixture claim/); assert.equal(result.collapse.valid, true); assert.ok(result.anchorAudits.length > 0); assert.ok(result.workers.length > 0);
  const proof = verifyRunBundle(result); assert.equal(proof.valid, true); assert.equal(proof.runId, result.runId); assert.equal(result.performance.usage.input, null); assert.equal(result.performance.cost.value, null);
  const tampered = structuredClone(result); tampered.artifact.text += '\nunrecorded change'; code(() => verifyRunBundle(tampered), 'RUN_RECORD_HASH_MISMATCH');
});
test('C01 C07 unsupported prose fails closed and source-free AUDIT waits', async () => {
  const runtime = await verifyRuntime(), root = path.join(runtime.root, 'plugins/hypervisor-standalone/runtime');
  const prepared = await prepareTask(taskInput(), { root, mode: 'DRY_RUN' });
  const failed = await executePrepared(prepared, { execute: async () => ({ text: 'A new public claim with no exact source support.', citations: [] }), root, persist: false, fixture: true });
  assert.equal(failed.state, 'FAILED'); assert.equal(failed.trustedOutput, false);
  const audit = taskInput('AUDIT'); audit.sources = []; const waiting = await prepareTask(audit, { root, mode: 'DRY_RUN' }); assert.equal(waiting.state, 'WAITING_EVIDENCE');
});
