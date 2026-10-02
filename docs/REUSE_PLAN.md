# Reuse plan and owning modules

Preserve MASTER_SPEC.md, CODEX_START.md and the verified release payload unchanged. Use the installed native Hypervisor task lifecycle for bounded source proposals. Integrate validated source proposals into a separate reversible checkout.

Shallow implementation tree:

```
ai-architecture-dossier/
  docs/                     # provenance, contribution and limitations
  packages/lab/             # exact archive, sparse packing, analytics
  tests/                    # executable mechanism and statistics tests
  scripts/                  # catalogue, result generation and verification
  dist/                     # public site and shared browser module copies
  experiments/              # frozen protocols and sanitized result bundles
  .openai/hosting.json       # Sites identity and static output declaration
```

No historical source repository is copied or rewritten. Use explicit interfaces rather than introducing parallel Souls, memory, authority or database owners. All unimplemented component mechanisms retain unavailable evidence. The release cannot claim complete implementation of all 28 components.

Reuse now includes optional direct imports of the approved supplied 2.1.0 dependency from `experiments/runtime/tests/runtime-helper.mjs`. These imports happen only after verifying all manifest members; the public checkout retains probes and receipts, not runtime source. The site displays this evidence separately from the browser reference implementation. See `docs/RUNTIME_EVIDENCE.md` and `npm run test:runtime`.

Publication authorization comes from the current human request. The attached documents' preparation-only wording is a source boundary, not a cancellation of that request. Provider calls and model training remain outside this implementation's authority and budget.

Original Headspace reuse is read-only and source-pinned. `scripts/test-headspace-source.mjs` executes allowlisted inspected files in an owned temporary copy, with an allowlisted child environment and best-effort default fetch guard. It verifies original hashes before and after execution. The original source and private lexical metadata are excluded from publication. `packages/lab/serialized-commit.mjs` is the small new owning adapter; it serializes commits within one instance without claiming durability or cross-process exclusion. Builds publish frozen derived receipts and the empty-inventory trace, without executing the optional source probe.

Optional Agent Database checks reuse the existing Python owner through owned copies of 19 pinned source files. `scripts/test-agentdb-source.mjs` verifies the approved runtime dependency, original source and interpreter; `experiments/agentdb/execute.py` runs original offline tests under a best-effort audit hook; `experiments/agentdb/probe.py` adds synthetic probes and the frozen application-cache experiment. No original code, state or keys enter the public source tree. `npm run test:agentdb` is separate from the dependency-free public build. Full SOULS, qualification, worker restart and independent key custody are excluded.
