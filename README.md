# AI Architecture Dossier

An architectural design portfolio by **novacanenumb**: 28 component contracts covering context, bounded generation, language research, agent control, evidence and measurement.

This release documents the whole design programme and implements a dependency-free sparse context, exact archive and statistical analytics reference slice. Its browser lab executes the same modules as the Node tests. Historical source reports retain their provenance; missing historical code is not reconstructed as an existing contribution.

## Reproduce

Use Node.js 22 or later. No packages, API keys or model calls are required.

```text
npm test
npm run benchmark
npm run build
npm run verify
npm run verify:public
npm run preview
```

The preview prints its local URL; `dist` is the static publication directory. Explore the [limitations](docs/LIMITATIONS.md), [contribution map](docs/CONTRIBUTION_MAP.md), [protocol](experiments/protocol.json), and [results](dist/data/results.json).

## Architecture and design intent

The programme separates exact history, task context, generation boundaries, worker proposals, evidence validation and permission to change external state. A smaller inference packet remains useful when its protected facts survive and its original sources stay addressable. Each boundary has its own contract: a proposed answer does not authorize a tool, and an exact-text match does not establish an external claim's truth.

```mermaid
flowchart LR
    Archive["C03 Exact archive"] -->|"Versioned source ranges"| Context["C02 Sparse context"]
    Context --> Routing["C04 Task-specific routing"]
    Routing --> Anchors["C06 Sealed anchors"]
    Anchors --> Candidates["C07 Bounded candidates"]
    Candidates --> IR["C09 Semantic IR"]
    IR --> Evidence["C21 Evidence and contradictions"]
    Evidence --> Completion["C22 Observable completion"]
    Completion --> Release["C28 Replay and publication"]
    Control["C01 Control plane"] -.-> Anchors
    Authority["C19 Authority broker"] -.-> Completion
    Metrics["C27 Complete accounting"] -.-> Routing
    Metrics -.-> Release
```

This is a conceptual path through the catalogue, not a validated execution DAG or a requirement to run every component on every task. Small tasks can use fewer mechanisms. API-level parallel generation, experimental language composition and model-native decoder research have different interfaces and evidence requirements.

The site presents four flagship families—sparse context, anchor-bounded generation, Headspace and multi-agent context routing—and seven views for each component: Overview, Lab, Architecture, Tests, Benchmarks, Failure Cases and Documentation. The shared context lab executes the same core modules as the Node tests. Unavailable mechanisms retain an explicit status.

## Component guide

The [component registry](component-registry.json) preserves historical source status separately from implementation in this checkout. “Design” below means documented here; original historical source code has not been inspected. “Reference” means a bounded new implementation with partial acceptance evidence.

| ID | Component | Scope in this release |
| --- | --- | --- |
| C01 | Hypervisor control plane | Design |
| C02 | Sparse context compression compiler | Reference slice |
| C03 | Exact archive and context materializer | Reference slice |
| C04 | Multi-agent context routing | Model-free packet-routing demonstration |
| C05 | Cache hierarchy and invalidation | Design |
| C06 | Anchor compiler and sealed boundary graph | Design |
| C07 | Anchor-bounded parallel generation: ABES | Design |
| C08 | Native bidirectional multi-anchor decoding | Native research design |
| C09 | Semantic intermediate representation and patch reducer | Design |
| C10 | Rotating expert synthesis and bounded local repair | Design |
| C11 | Headspace polyphonic composition | Experimental design |
| C12 | Dialect dictionaries, probability profiles and user-model packages | Design |
| C13 | Prefix-state proposal and commitment layer | Design |
| C14 | Language diversity and convergence analyser | Design and reference statistical utilities |
| C15 | Measured routing and adaptive compute allocation | Design |
| C16 | 02_SOULS definition and lifecycle registry | Historical design |
| C17 | Agent database and scoped memory dossiers | Design |
| C18 | Bootstrap compiler and qualification bootcamp | Design |
| C19 | Authority broker and command bus | Design |
| C20 | Signed working agreements and attestation | Design |
| C21 | Evidence ledger and contradiction verification | Design |
| C22 | GTFL positive-state execution kernel | Design; separate native-run receipts supplied |
| C23 | RTL360-GTFL native language model | Native research design |
| C24 | Rotor, harmonic and hierarchical lattice routing | Native research design |
| C25 | Collapsed Route-State Cache and approved S3L memory | Native research design |
| C26 | Native training, checkpoint promotion and neural laboratory | Native research design |
| C27 | Telemetry, analytics and benchmark evidence engine | Reference slice |
| C28 | Replay, reproducible releases and portfolio publication | Design and current publication tooling |

The catalogue includes **122 acceptance requirements** and **154 specified metric endpoints**. Full component acceptance is not claimed: the evidence matrix uses `PARTIAL_REFERENCE_EVIDENCE` and `NOT_RUN`. A passing local fixture cannot complete a native decoder, a hosted provider evaluation or a production authority service.

## Exact archive API

[`ExactArchive`](packages/lab/core.mjs) is an in-memory reference store. It retains exact byte-addressable revisions with SHA-256 hashes, checks correction preconditions, filters by explicit ownership scope, and purges raw historical bytes on deletion. Returned byte arrays and metadata are defensive copies.

```js
import { ExactArchive } from './packages/lab/core.mjs';

const archive = new ExactArchive();
const first = await archive.append({
  id: 'public-example', content: 'A😀B', metadata: { synthetic: true }
});
// UTF-8 byte offsets 1..5 select the complete emoji.
const span = archive.materialize({
  id: 'public-example', version: first.version, startByte: 1, endByte: 5
});
console.log(span.text); // 😀
await archive.correct({
  id: 'public-example', content: 'A revised public example',
  expectedVersion: first.version
});
console.log(archive.materialize({ id: 'public-example', version: 1 }).text);
archive.delete({ id: 'public-example' }); // purges every raw version
```

The default scope is `public`. A scope callback is a local policy hook; it does not authenticate humans. The archive is not a durable multi-user database or a replacement for every C03 projection. The current browser lab demonstrates context packets; archive lifecycle behavior is exposed through this API and its tests.

## Comparison API and observed results

The comparison API generates a public synthetic history and executes five context-selection arms on the same permitted source records:

```js
import { runComparison } from './packages/lab/core.mjs';

const result = await runComparison({
  historySize: 64, budgetBytes: 6000,
  recentCount: 12, retrievalLimit: 12, workers: 4
});
console.log(result.arms.sparse.bytes); // 3892
console.log(result.arms.combined.exactFactRecall); // 1
console.log(result.arms.combined.cost); // null
```

Sparse packing retains pinned policy and required exact facts atomically. Insufficient budgets return `PINNED_OVERFLOW` and prevent dispatch. Combined routing partitions required facts across workers, counts shared pins in every packet, and includes routing overhead. Navigation bridges never replace exact source evidence.

The main configuration contains 64 synthetic milestones, 129 source records, a 6,000-byte budget per bounded packet and four workers.

| Arm | Serialized input bytes | Required exact-span coverage |
| --- | ---: | ---: |
| Full context | 37,075 | 100% |
| Recent tail | 3,600 | 0% |
| Lexical retrieval | 3,566 | 100% |
| Sparse exact packing | 3,892 | 100% |
| Combined worker routing | 4,440 | 100% |

The full arm is a **model-free full-context baseline**. Bytes are measured UTF-8 JSON transport, including headers and duplicate shared inputs. Exact-span coverage checks whether required synthetic facts are in packets; it does not score generated answers. Combined routing uses more bytes than the sparse arm in this fixture.

The benchmark attempts 16 ordinary configurations and one deliberate overflow. All 17 remain in the failure-rate denominator. Failed configurations receive no claimed efficiency gain; the failed pair is explicitly omitted from the byte bootstrap and its exclusion count is retained. Related configurations and repeated histories are not independent population tasks.

No standalone hosted model was executed. The full Hypervisor has not been benchmarked against standalone models here. Historical source reports of 147 tests, 16/16 needles and 95.758% byte reduction are not reused as current measurements. All 154 default-model endpoint comparisons remain unavailable until matched component/backend experiments run.

## Statistical analytics with known vectors

[`analytics.mjs`](packages/lab/analytics.mjs) defines guarded ratios, token amplification, accepted-token throughput, complete workflow usage and cost aggregation, seeded paired bootstrap, Unicode MATTR, repeated trigram rate, sample coefficient of variation and aligned-support base-2 Jensen–Shannon divergence.

```js
import { tokenAmplification, pairedBootstrap, mattr,
  repeatedTrigramRate, jensenShannon } from './packages/lab/analytics.mjs';

console.log(tokenAmplification(1200, 800).value); // 1.5
console.log(mattr('a b a c', 3).value); // 5 / 6
console.log(repeatedTrigramRate('a b c a b c a b c').value); // 4 / 7
console.log(jensenShannon([1, 0], [0, 1]).value); // 1 bit
console.log(pairedBootstrap({
  baseline: [1, 2, 3], candidate: [2, 3, 4],
  iterations: 2000, confidence: 0.95, seed: 1729
}).interval); // [1, 1]
```

Known-vector tests establish the arithmetic. Missing observations stay null; cached input and reasoning tokens are treated as subsets instead of added twice. Failed, retry and review calls remain in total workflow accounting. Fixed configuration confidence intervals do not establish Headspace language quality, human outcomes or model noninferiority.

## Validation, provenance and contribution history

The 24 behavioral and statistical tests cover Unicode bytes and boundaries, scope isolation, correction history, race preconditions, deletion, deterministic ranking, pinned overflow, source-span recall, complete transport accounting and statistical vectors. All 17 fixture configurations reproduced exactly on a second execution. See the [evidence guide](docs/EVIDENCE.md), [test receipt](experiments/test-receipt.json), [release report](experiments/release-verification.json) and [public-checkout report](experiments/public-checkout-verification.json).

`npm run verify:public` reconstructs a source copy without the original master specification or supplied runtime, then runs its tests, build and release checks. Public builds use the committed sanitized registry. The preview binds to `127.0.0.1`, prints its actual URL, and serves `/api/health`; set `DOSSIER_PORT` to choose another local port.

The architecture programme is credited to **novacanenumb**. The catalogue derivation, JavaScript reference mechanisms, tests and presentation are AI-assisted new work with parent integration. They do not reconstruct missing historical implementations as inspected source. Original documents remain outside this public checkout. The derived catalogue records the specification identifier, source IDs, line references and digest.

The native source-proposal run reached ephemeral `REPORTED` completion with three Sol-role proposals, schema/anchor checks, the nonempty validator and valid GTFL collapse. Its [receipt](experiments/native/receipt.json), [manifest](experiments/native/manifest.json), [ledger](experiments/native/tokenLedger.json) and [performance record](experiments/native/performance.json) remain separate from host behavioral tests. No general semantic validator or durable runtime commit is claimed. Runtime timings include orchestration and proposal waits; their serial-equivalent ratio is not an executed standalone-model benchmark.

Finite secret-pattern checks are not a comprehensive security audit. The task-scoped `HYPERVISOR_BYPASS_APPROVED` exception covers Git initialization, commits, remote setup and pushes; those actions are not Hypervisor Git-handler validated mutations. It does not authorize paid provider calls or redistribution of the supplied runtime.

## Supplied Hypervisor runtime probes

The supplied **Hypervisor 2.1.0 implementation** now has a separate suite of **45 executed behavioral probes**, all passing with zero failures or skips. These establish partial local mechanism evidence across 12 components: C01, C02, C03, C06, C07, C09, C15, C19, C21, C22, C27 and C28. They complement the 24 public reference tests and do not replace the full component acceptance contracts.

The probes exercise bounded scheduling, measured-routing provenance, immutable future routing revisions, atomic GTFL frames, deduplicated support, capsule replay, complete ephemeral fixture run bundles, exact archive hashes, header reconstruction, pinned overflow, deterministic retrieval, anchor dependency gates, protected section revisions, authority attenuation, evidence contradictions and complete usage arithmetic. Their runner checks the approved dependency manifest, content root, complete file set and all 85 member hashes before importing runtime code. The separately licensed runtime remains outside this repository and the deployment.

Run `npm run test:runtime` with Node 26 or later and the approved dependency at `../HYPERVISOR-2.1-STABLE`; set `DOSSIER_RUNTIME_PATH` when it is elsewhere. This command fails explicitly if the package is absent or differs from the approved source. The regular reference tests and public site still work without it.

Read the [runtime evidence guide](docs/RUNTIME_EVIDENCE.md), [executed probe receipt](experiments/runtime/test-receipt.json), [partial acceptance map](experiments/runtime/coverage.json), and [native source receipt](experiments/runtime/native/receipt.json). These tests establish implemented local behavior using synthetic inputs; hosted model quality, token consumption, billing and inference latency remain unmeasured.

## Measured serial versus concurrent scheduling

The supplied scheduler also ran a frozen four-task dependency graph under concurrency 1 and concurrency 3. Three independent tasks use abort-aware timer waits of 12, 18 and 24 milliseconds; the join waits 6 milliseconds after its parents finish. Every callback returns the same deterministic integer result in both arms. Eight pairs alternate which arm runs first. All 16 attempts are retained, with zero failed attempts, eight eligible pairs, zero exclusions and equal output hashes.

| Locally observed measure | Result |
| --- | ---: |
| Executed serial mean scheduler wall time | 93.81 ms |
| Executed concurrent mean scheduler wall time | 46.41 ms |
| Ratio of paired means | 2.02× |
| Paired mean difference, concurrent minus serial | −47.40 ms |
| 95% seeded percentile bootstrap interval | −49.41 to −46.26 ms |

This ratio measures overlap of controlled asynchronous waits on the recorded machine. Timer resolution, host load and orchestration affect the observed durations. It does not establish neural compute speed, provider latency, streamed throughput, model quality or billing. The confidence interval describes the recorded paired fixture observations; it does not establish a population result or model noninferiority. Summed callback duration remains a separately labelled serial estimate; the reported comparison uses an actually executed serial baseline.

Run `npm run benchmark:scheduler` separately with the verified runtime and Node 26 or later. The [frozen protocol](experiments/runtime/scheduler-protocol.json) records the DAG, limits, pairing order and statistic before execution. The [full attempt log](experiments/runtime/scheduler-results.json) retains callback intervals, scheduler bounds, validated DAG critical paths, source hashes and unknown model measurements. The bootstrap uses 4,000 iterations, 95% confidence and seed 1729; it reproduces exactly for the recorded vector. Wall-clock times themselves are not deterministic. Static builds copy this frozen report and do not rerun timing experiments.

The added test sources and benchmark runner have a separate [native source receipt](experiments/runtime/native-scheduler/receipt.json). Native source validation and parent behavioral verification have different scopes. The earlier [23-probe receipt](experiments/runtime/history/23-probe-release/test-receipt.json), runner bytes and native artifact remain intact, so publication history is inspectable.

## Next experiments and contributions

Further evidence requires the relevant actual implementation, a frozen corpus, declared model/backend revisions, complete call accounting, a quality rubric and matched baseline/candidate runs. Native decoder, training and language-profile experiments require their own implementations and validators. Improvements should be reported only after the corresponding experiment runs, with failed attempts and unknown measurements preserved.

Contributions should identify the owning component, baseline, failure cases and evidence limits. Use [SECURITY.md](SECURITY.md) for security reports.

The custom **Novacanenumb Open Design License 1.0** permits commercial and noncommercial use, modification and redistribution with attribution, retained notices and identification of material changes. It includes a limited contributor patent grant and warranty terms. No OSI approval is claimed. Read the complete [licence](LICENSE) and use [CITATION.cff](CITATION.cff) when crediting the work.
