# C04: original-source context routing

The dossier's C04 probes exercise the supplied Hypervisor 2.1.0 implementation. They check how execution delivers committed parent sections, requires exact source aliases and rejects missing dependencies. The probes are newly authored public tests of original runtime code. The separately licensed runtime remains immutable and is excluded from this repository.

The small fixture also exposes a limit: an anchor's `sourceIds` are mandatory references, not a permission filter. Additional source records can enter its materialized context when capacity permits. Required-source preservation and permission-filtered isolation need separate evidence.

## Reproduction and source identity

Run `npm run test:routing` with Node 26 or later and the separately obtained, approved dependency. Set `DOSSIER_RUNTIME_PATH` when its location differs from the workspace default. The shared source helper checks the 2.1.0 version, approved manifest digest, declared content root, complete 85-file set and every file's size and hash before imports. Requested modules are rehashed at import time.

The command records seven behavioral checks in `experiments/routing/test-receipt.json`. The result includes the exact probe, runner and helper hashes, dependency identity, test outcomes and the public synthetic packet diagnostic. The existing 45-test runtime receipt and its history remain separate. A static build copies the recorded result; it does not execute the dependency or regenerate measurements.

Hash verification binds these tests to packaged bytes. It does not authenticate a publisher, confine subprocesses or prove deployed model behavior. Test results describe only the supplied version and public inputs.

## Four anchors and committed parent delivery

The execution fixture has anchors `a`, `b`, `unrelated` and `child`. The first three can produce outputs in the same frontier. The child declares dependencies on `a` and `b`. Its callback receives exactly those two parent sections, including their complete text and content hashes; the committed `unrelated` section is excluded from that parent-section list.

This selection occurs inside `executePrepared`. It passes previously committed sections whose `anchorId` is in the current anchor's dependencies. Sections enter that list only after the runtime completes evidence checks, GTFL validation and the anchor's `COMMITTED` transition. An invalid parent proposal prevents the dependent child from being dispatched. The test uses source-free synthetic output statements with `evidenceMode: none`; it demonstrates declared structural validation and completion gates without claiming those statements are exact-source factual evidence.

Every input source is deliberately public and synthetic. Excluding an unrelated committed **parent section** does not establish exclusion of the same anchor's **source records**. These are different packet fields with different selection rules.

## Source aliases preserve required records

`prepareTask` converts normalized source contents into an exact archive and materializes context for each executable anchor. It maps that anchor's source aliases to mandatory exact records. A missing declared source alias throws `ANCHOR_SOURCE_UNAVAILABLE` during preparation.

The materializer can also retrieve other archive records within its capacity. In the small two-source fixture, both approved public source records enter all anchor contexts even when an anchor names only one alias. This is a reproducible diagnostic of the current API, not a test using real private information. Callers must filter their authorized source pool before preparation when their application requires record-level access restrictions. The supplied API has no demonstrated source-permission contract in these inputs.

The parent retains the exact archive, but archive availability alone does not establish automatic discovery, semantic recognition or reconciliation of cross-anchor contradictions. Those parts of C04-T02 remain unresolved.

## Packet construction and execution have different contracts

The lower-level `taskPacket(prepared, task, parentSections)` helper clones and freezes the parent sections its caller supplies. It checks the canonical serialized packet's UTF-8 byte size against the anchor's `contextBudgetTokens` value. Despite that field's name, this check does not measure provider tokens.

The helper does not independently establish that supplied parent sections were committed or belong to the anchor's dependencies. A test passes an arbitrary public section and confirms the clone is immutable and unaffected by later changes to the caller's object. This documents caller responsibility; it is not evidence of a failed authorization check promised by that helper.

Dependency routing tests therefore exercise `executePrepared`. A successful call to the packet helper alone is insufficient evidence of committed-parent selection, evidence validation or source authorization.

## Acceptance coverage

| Specification requirement | Observed scope | Remaining evidence |
| --- | --- | --- |
| C04-T01: declared committed parents, without unrelated private context | The child receives the complete committed `a` and `b` sections; unrelated parent sections are absent | Private-record filtering and all production handoffs are unverified |
| C04-T02: globally discoverable cross-anchor contradiction | Required exact sources survive preparation; the parent retains the archive | Automatic global contradiction discovery and permission-filtered audit are unverified |
| C04-T03: aggregate classifier, broadcast and handoff accounting | The four-role diagnostic matches every executed candidate callback to one fixture ledger event and counts its delivered packet bytes | No separate classifier call runs; provider token, latency and billing measurements are unavailable |
| C04-T04: missing exact dependency remains unresolved | Missing source aliases and graph dependencies fail preparation with `ANCHOR_SOURCE_UNAVAILABLE` and `MISSING_DEPENDENCY` | These errors are not the specification's literal `UNRESOLVED` state; general retrieval fallback is unverified |

The missing-dependency test names an absent graph anchor. It does not claim that `MISSING_DEPENDENCY` is the runtime response to every uncommitted parent. The separate invalid-parent test checks that dependent execution never starts.

## Reading packet accounting

The recorded diagnostic counts canonical bytes for the actual packets delivered to the four fixture callbacks. Source-content bytes and parent-section bytes are separately labelled. A constructed broadcast packet uses the same public archive and prior output set for comparison. That construction is an accounting control; it is not a second executed model or measured broadcast workflow.

For this small corpus, required source aliases do not reduce source duplication because the archive fits in every context. Any reduction in delivered parent-section bytes concerns the declared dependency list. Counts exclude hidden host prompts, provider framing, transport metadata and provider tokenizer behavior. Packet bytes must not be reported as billed input tokens or inferred model cost.

The fixture's local provider-call count is zero. Host proposal usage for authoring these tests is a separate, unavailable measurement. Hosted tokens, cost, inference latency, output quality and a matched standalone-model baseline remain `null`. Deterministic packet selection establishes local mechanics; hosted model regeneration is not demonstrated as deterministic.
