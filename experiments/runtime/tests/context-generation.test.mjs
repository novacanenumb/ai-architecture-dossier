import test from 'node:test';
import assert from 'node:assert/strict';
import { runtimeModule } from './runtime-helper.mjs';
const C = await runtimeModule('02_CONTEXT_PLANE/context.mjs');
const G = await runtimeModule('03_GENERATION_PLANE/generation.mjs');
const code = (fn, expected) => assert.throws(fn, e => e.code === expected);
const source = (content, id, extra = {}) => ({ content, locator: { uri: 'synthetic:' + id }, ...extra });
const authority = { capabilities: ['context.read', 'proposal.submit'], mutation: false, network: false };
const request = { objective: 'Public synthetic bounded proposal', requirements: [{ id: 'r1', text: 'Preserve exact requirements', mutability: 'EXACT' }] };
const graphOf = (anchors = [{ id: 'work', objective: 'Draft bounded proposal', requirementIds: ['r1'] }]) => G.compileAnchorGraph({ request, anchors, authority });
const work = (graph, id = 'work') => graph.anchors.find(a => a.logicalId === id);
const sectionOf = (anchor, mutability = 'SEMANTIC') => G.createSectionIR({ sectionId: 'public-section', anchorId: anchor.id, sourceAgentId: 'author', nodes: [{ nodeId: 'n1', type: 'paragraph', text: 'Original public wording', mutability, claimIds: [] }], claimIds: [], evidenceReceiptIds: [] });
const patchOf = (section, overrides = {}) => G.createRevisionPatch({ patchId: 'patch', targetNodeId: 'n1', preconditionHash: section.nodes[0].contentHash, operation: 'replace', category: 'style', sourceAgentId: 'proposer', reviewerId: 'independent-reviewer', review: { approved: true }, node: { nodeId: 'n1', type: 'paragraph', text: 'Revised public wording', mutability: section.nodes[0].mutability, claimIds: [] }, evidenceReceiptIds: [], ...overrides });

test('C03 exact source IDs, duplicate rejection, immutable hashes and missing-source failure', () => {
  const input = source('A😀B\r\nExact public bytes', 'unicode');
  const archive = C.createExactArchive([input]);
  const record = C.exactLookup(archive, [archive.records[0].id])[0];
  assert.equal(record.content, input.content);
  assert.equal(C.verifyExactArchive(archive), archive);
  assert.ok(Object.isFrozen(archive.records[0]));
  code(() => C.createExactArchive([input, input]), 'DUPLICATE_ID');
  code(() => C.createExactArchive([{ ...input, id: 'invented-id' }]), 'NON_CONTENT_ADDRESSED_ID');
  code(() => C.createExactArchive([source('Bridge', 'bridge', { authority: 'SYNTHETIC_BRIDGE' })]), 'NON_EXACT_ARCHIVE_AUTHORITY');
  code(() => C.exactLookup(archive, ['absent']), 'EXACT_SOURCE_UNAVAILABLE');
  const altered = structuredClone(archive); altered.records[0].content += '!';
  code(() => C.verifyExactArchive(altered), 'HASH_MISMATCH');
});

test('C02 header reconstruction preserves exact approval sources, contradictions and pinned overflow', () => {
  const archive = C.createExactArchive([source('Decision', 'decision'), source('Approved', 'approval', { sourceKind: 'approval_evidence' })]);
  const approval = archive.records.find(r => r.sourceKind === 'approval_evidence');
  const decision = archive.records.find(r => r.sourceKind === 'history');
  code(() => C.rebuildHeader(archive, { decisions: [{ id: 'd', state: 'ACCEPTED', sourceIds: [decision.id] }] }), 'ACCEPTED_DECISION_NEEDS_APPROVAL_EVIDENCE');
  const header = C.rebuildHeader(archive, { pinnedSourceIds: [decision.id], decisions: [{ id: 'd', state: 'ACCEPTED', sourceIds: [decision.id], approvalEvidenceSourceId: approval.id }], contradictions: [{ id: 'c', sourceIds: [decision.id, approval.id] }] });
  assert.equal(C.verifyHeader(header, archive), header);
  assert.equal(header.decisions[0].approvalEvidenceSourceId, approval.id);
  assert.equal(header.contradictions[0].status, 'UNRESOLVED');
  assert.equal(C.contextManifest(archive, header).archiveHash, archive.archiveHash);
  const pages = C.buildPageTable(archive);
  assert.ok(pages.pages.every(p => p.authority === 'ANCHORED_SUMMARY' && p.exactSourceId && p.navigation.length <= 160));
  code(() => C.rebuildHeader(archive, { headerMaximum: 1 }), 'PINNED_HEADER_OVERFLOW');
});

test('C02 deterministic lexical retrieval validates external similarity values', () => {
  const archive = C.createExactArchive([source('needle alpha', 'a'), source('needle beta', 'b')]);
  const header = C.rebuildHeader(archive);
  const scores = Object.fromEntries(archive.records.map(r => [r.id, .5]));
  const selected = C.retrieve(header, archive, 'needle', { similarity: scores, limit: 2 });
  assert.deepEqual(selected.map(r => r.exactSourceId), archive.records.map(r => r.id).sort((a,b) => a.localeCompare(b)));
  assert.ok(selected.every(r => r.score === 1.5));
  code(() => C.retrieve(header, archive, 'needle', { similarity: { [archive.records[0].id]: 1.01 } }), 'INVALID_PRECOMPUTED_SIMILARITY');
});

test('C02 materialization keeps mandatory sources and fails when pins exceed the window', () => {
  const archive = C.createExactArchive([source('Exact old value', 'old'), source('Recent context', 'recent')]);
  const header = C.rebuildHeader(archive), required = archive.records[0].id;
  const input = { archive, header, anchorId: 'anchor', query: 'context', requiredExactIds: [required], outputReserveTokens: 64 };
  const packet = C.materialize(input);
  assert.equal(packet.status, 'READY');
  assert.equal(packet.capacityEstimate, 32000);
  assert.equal(packet.estimateProvenance, 'locally_measured_upper_bound');
  assert.ok(packet.exact.some(r => r.id === required));
  code(() => C.materialize({ ...input, outputReserveTokens: 32001 }), 'OUTPUT_RESERVE_OVERFLOW');
  code(() => C.materialize({ ...input, requiredExactIds: ['absent'] }), 'EXACT_SOURCE_UNAVAILABLE');
  const large = C.createExactArchive([source('x'.repeat(32001), 'large')]);
  const overflow = C.materialize({ archive: large, header: C.rebuildHeader(large), anchorId: 'anchor', query: 'large', requiredExactIds: [large.records[0].id] });
  assert.equal(overflow.status, 'PINNED_OVERFLOW');
  assert.equal(overflow.exact, undefined);
});

test('C02 synthetic bridges cannot satisfy evidence or exceed the declared fraction', () => {
  const archive = C.createExactArchive([source('Exact public history with enough content for a tiny bridge', 's')]);
  const base = { archive, header: C.rebuildHeader(archive), anchorId: 'a', query: 'history' };
  const bridge = { authority: 'SYNTHETIC_BRIDGE', sourceIds: [archive.records[0].id], text: 'nav' };
  assert.equal(C.materialize({ ...base, bridges: [bridge] }).bridges[0].authority, 'SYNTHETIC_BRIDGE');
  code(() => C.materialize({ ...base, bridges: [{ ...bridge, canSatisfyEvidence: true }] }), 'SYNTHETIC_BRIDGE_AUTHORITY_ESCALATION');
  code(() => C.materialize({ ...base, bridges: [{ ...bridge, text: 'x'.repeat(4096) }] }), 'SYNTHETIC_FRACTION_EXCEEDED');
});

test('C02 pressure thresholds preserve the pinned overflow priority', () => {
  const actions = [71,72,84,92].map(activeTokens => C.governContext({ activeTokens, capacityTokens: 100 }).action);
  assert.deepEqual(actions, ['NONE','INCREMENTAL_COMPACTION','FULL_REBUILD','EMERGENCY_COMPACTION']);
  assert.equal(C.governContext({ activeTokens: 1, capacityTokens: 100, pinnedTokens: 101 }).action, 'PINNED_OVERFLOW');
});

test('C06 sealed anchor graphs preserve requirements, deterministic order and authority ceilings', () => {
  const anchors = [{ id: 'a', objective: 'First', requirementIds: ['r1'] }, { id: 'b', objective: 'Second', dependencies: ['a'] }];
  const graph = graphOf(anchors);
  assert.equal(graph.graphHash, graphOf([...anchors].reverse()).graphHash);
  assert.ok(graph.anchors.every(a => a.id === a.anchorHash));
  assert.ok(G.frontiers(graph).flat().includes(work(graph, 'b').id));
  code(() => graphOf([{ id: 'a', objective: 'First' }]), 'UNREPRESENTED_REQUIREMENT');
  code(() => graphOf([{ id: 'a', objective: 'First', requirementIds: ['r1'], dependencies: ['missing'] }]), 'MISSING_DEPENDENCY');
  code(() => graphOf([{ ...anchors[0], dependencies: ['b'] }, anchors[1]]), 'ANCHOR_CYCLE');
  code(() => graphOf([{ ...anchors[0], authority: { capabilities: ['network.execute'], proposalOnly: true } }]), 'AUTHORITY_EXPANSION');
});

test('C06 lifecycle rejects dependency dispatch and requires evidence gates before commit', () => {
  const graph = graphOf([{ id: 'parent', objective: 'Parent', requirementIds: ['r1'] }, { id: 'child', objective: 'Child', dependencies: ['parent'] }]);
  const parent = work(graph, 'parent'), child = work(graph, 'child'), life = new G.AnchorLifecycle(graph);
  code(() => life.transition(parent.id, 'DISPATCHED'), 'INVALID_ANCHOR_TRANSITION');
  life.transition(child.id, 'CONTEXT_BOUND');
  code(() => life.transition(child.id, 'DISPATCHED'), 'DEPENDENCY_NOT_COMMITTED');
  for (const state of ['CONTEXT_BOUND','DISPATCHED','CANDIDATES_READY','PATCHED']) life.transition(parent.id, state);
  code(() => life.transition(parent.id, 'EVIDENCE_VERIFIED'), 'ANCHOR_GATE_RECEIPT_REQUIRED');
  for (const state of ['EVIDENCE_VERIFIED','GTFL_VALIDATED','COMMITTED']) life.transition(parent.id, state, { passed: true, receiptHash: 'synthetic-receipt' });
  life.transition(child.id, 'DISPATCHED');
  assert.deepEqual(life.regenerate(parent.id).affected, [parent.id,child.id].sort());
  assert.equal(life.canCommit(), false);
});

test('C06 graph revisions preserve immutable request and exact ancestry preconditions', () => {
  const graph = graphOf();
  const input = { request, anchors: [{ id: 'work', objective: 'Revised local work', requirementIds: ['r1'] }], authority, version: 2, previousGraphHash: graph.graphHash };
  const revised = G.reviseAnchorGraph(graph, input);
  assert.equal(revised.previousGraphHash, graph.graphHash);
  assert.notEqual(revised.graphHash, graph.graphHash);
  code(() => G.reviseAnchorGraph(graph, { ...input, version: 1 }), 'GRAPH_VERSION_PRECONDITION');
  code(() => G.reviseAnchorGraph(graph, { ...input, request: { ...request, objective: 'Altered locked request' } }), 'LOCKED_REQUEST_CHANGED');
});

test('C09 section validators enforce anchor binding, required claims and mutability', () => {
  const graph = graphOf([{ id: 'work', objective: 'Checked section', requirementIds: ['r1'], validators: ['semantic'], requiredClaims: ['c1'] }]);
  const anchor = work(graph), section = sectionOf(anchor);
  code(() => G.validateSectionAgainstAnchor(section, anchor, { validators: { semantic: () => true } }), 'REQUIRED_CLAIM_MISSING');
  const claimed = G.createSectionIR({ ...section, claimIds: ['c1'] });
  code(() => G.validateSectionAgainstAnchor(claimed, anchor), 'ANCHOR_VALIDATOR_UNAVAILABLE');
  assert.equal(G.validateSectionAgainstAnchor(claimed, anchor, { validators: { semantic: () => true } }), claimed);
  code(() => G.validateSectionAgainstAnchor(sectionOf(anchor, 'SURFACE'), anchor), 'ANCHOR_MUTABILITY_WEAKENED');
});

test('C09 reviewed patches apply without mutation while stale and self approvals fail', () => {
  const anchor = work(graphOf()), section = sectionOf(anchor), original = structuredClone(section);
  const accepted = G.reducePatches(section, [patchOf(section)], { anchor });
  assert.equal(accepted.accepted.length, 1);
  assert.equal(accepted.section.nodes[0].text, 'Revised public wording');
  assert.deepEqual(section, original);
  const rejected = G.reducePatches(section, [patchOf(section, { patchId: 'stale', preconditionHash: 'stale' }), patchOf(section, { patchId: 'self', reviewerId: 'proposer' })], { anchor });
  assert.deepEqual(Object.fromEntries(rejected.rejected.map(r => [r.patchId,r.code])), { self: 'SELF_APPROVAL_DENIED', stale: 'STALE_PATCH' });
});

test('C09 exact and locked nodes remain protected despite independent review', () => {
  for (const mutability of ['EXACT','LOCKED']) {
    const anchor = work(graphOf([{ id: 'work', objective: 'Protected section', requirementIds: ['r1'], mutability }]));
    const section = sectionOf(anchor, mutability);
    const result = G.reducePatches(section, [patchOf(section)], { anchor });
    assert.equal(result.rejected[0].code, 'LOCKED_EXACT_NODE');
    assert.equal(result.section.nodes[0].text, section.nodes[0].text);
  }
});
