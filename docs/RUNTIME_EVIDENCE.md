# Evidence from the supplied Hypervisor 2.1.0 implementation

The dossier now includes 23 independently authored behavioral probes executed against the supplied Hypervisor implementation. All passed, with no failures or skipped tests, on Node v26.3.1 and Windows. These complement the 24 public reference tests; the two suites have different owners and dependencies.

| Component | Actual owning module | Tested behavior |
| --- | --- | --- |
| C02 | `02_CONTEXT_PLANE/context.mjs` | Exact approvals and contradictions in headers, deterministic retrieval, pinned overflow, synthetic bridge limits and pressure thresholds |
| C03 | `02_CONTEXT_PLANE/context.mjs` | Exact Unicode source text, content-addressed IDs, duplicate and missing-source rejection, immutable hashes |
| C06 | `03_GENERATION_PLANE/generation.mjs` | Requirement representation, cycles, authority ceilings, dependency gates and immutable revision ancestry |
| C09 | `03_GENERATION_PLANE/generation.mjs` | Section binding and validators, stale patches, self-approval rejection, exact/locked protection |
| C19 | `05_TOOL_AND_AUTHORITY_PLANE/broker.mjs` | Strict authority attenuation, frozen arguments, capability denial, disabled effects and cancellation |
| C21 | `06_EVIDENCE_PLANE/evidence.mjs` | Exact line receipts, source-hash checks, duplicate-content accounting, disputed and unresolved claims |
| C27 | `07_PERFORMANCE_PLANE/performance.mjs` | Cache subset accounting, failed retries, missing measurements, invalid timing and complete dependency DAGs |

Run `npm run test:runtime` with Node 26 or later. By default the runner expects the approved dependency at `../HYPERVISOR-2.1-STABLE`. Set `DOSSIER_RUNTIME_PATH` to its directory when stored elsewhere. This command is optional; the public reference suite and site do not require the runtime.

Before importing code, the helper verifies the exact approved manifest hash, identity, content root, all 85 file sizes and hashes, and complete file-set equality. Links and unsafe paths are rejected. The receipt records the executed test names, exit status, source hashes and dependency identity. A different runtime version or missing package fails explicitly. Integrity does not authenticate the publisher or prove that inspected source is free of defects.

The supplied runtime remains under its own licence and is excluded from this repository and deployment. The public additions contain original probes and derived evidence only. Sol-role workers proposed tests; the parent corrected inaccurate interface assumptions against observed source before execution and native submission. Test code authorship does not make a fixture reviewer a real independent semantic validator.

The [acceptance map](../experiments/runtime/coverage.json) intentionally reports partial supplied-runtime evidence. For example, a DAG-cycle check does not establish native lexical-anchor ordering; disabled tool effects do not establish operating-system confinement; preserved immutable source strings do not establish all ownership, edit and deletion projections.

Performance tests use declared synthetic usage and worker-interval vectors to verify arithmetic. The interval sum divided by wall time is not a measured serial-model speedup. No provider was called. Hosted token usage, billing, inference latency, generation quality and regeneration determinism remain unavailable. The separate native source-proposal orchestration report includes worker waits and host corrections; it is not a model-performance benchmark.

Receipts and commands:

- [Executed probe receipt](../experiments/runtime/test-receipt.json)
- [Context and generation probes](../experiments/runtime/tests/context-generation.test.mjs)
- [Evidence, authority and performance probes](../experiments/runtime/tests/evidence-performance.test.mjs)
- [Native source receipt](../experiments/runtime/native/receipt.json)
- [Native performance record](../experiments/runtime/native/performance.json)
- [Browser evidence bundle](../dist/data/runtime-evidence.json)
