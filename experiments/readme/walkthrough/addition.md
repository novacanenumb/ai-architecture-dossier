## Implementation walkthrough and integration contracts

The dossier is easiest to understand as a set of contracts between bounded stages. The architecture describes a much larger programme, while this repository records what each stage is intended to receive, what it may return, and what the public evidence actually demonstrates. The author of the architecture programme is **novacanenumb**; the dossier implementation and public reference lab are AI-assisted work whose provenance is separated in the [contribution map](docs/CONTRIBUTION_MAP.md).

The catalogue currently covers 28 components and 122 acceptance items. All 154 hosted-model metric fields remain `null`. Those counts describe the review surface; each component retains its own implementation and evidence status.

### 1. Archive and context contract

**Design intent.** Exact requirements, supplied sources, and accepted decisions enter an immutable archive before generation. A context layer then selects pinned requirements, recent history, source pointers, and bounded retrieved material. The intended output is a compact packet that preserves exact text where exactness matters while making omissions and byte budgets visible.

**Observed public evidence.** The dependency-free implementation in [packages/lab/core.mjs](packages/lab/core.mjs) provides a bounded exact-archive and context reference. The default suite checks versioned materialization, UTF-8 byte boundaries, Unicode and byte-order-mark cases, history behavior, deletion, scope callbacks, and deterministic fixture routing. Scope callbacks are application policy hooks; human authentication and broader privacy guarantees require separate evidence.

A missing required source remains a failure. A stale expected version must not silently read a newer record. If a byte range is invalid, the caller receives an error. These are practical negative controls: the reference is more useful when it demonstrates rejection of malformed or stale operations as well as successful reads.

The [source inventory](docs/SOURCE_INVENTORY.md) identifies what material was available to the dossier and what remained uninspected. Read it before interpreting a context result as comprehensive.

### 2. Anchor and worker-proposal contract

**Design intent.** A task is divided into sealed anchors. Each anchor carries its exact requirements, declared sources, dependencies, budget, and validation conditions. A later anchor may receive committed parent sections named by its dependency graph. Workers return proposals. Canonical-write authority, secrets, network access, and approval rights stay outside the worker contract.

**Observed public evidence.** The native Hypervisor Standalone 2.1.0 runs used structural, nonempty, anchor, and GTFL checks. These establish selected artifact-shape, anchor, and completion conditions. General semantic correctness and external factual truth require additional validators.

The source-runtime record contains 45 dossier probes against the supplied runtime plus seven newly authored C04 routing tests. Those routing tests examine dependency-selected committed parent sections and fail-closed missing inputs. Global source permissions and private-data non-disclosure remain separate questions. The detailed boundary is documented through the repository's evidence classifications.

### 3. Evidence, contradiction, and authority contract

**Design intent.** A proposal becomes eligible for completion after its material claims are linked to declared sources or validators. Supporting and contradicting receipts remain distinct, and unresolved material stays unresolved. Authority is carried separately from evidence: a source can support a claim while permission to mutate a repository, contact a provider, or publish a release must come from the applicable authorization.

**Observed public evidence.** The dossier tests exact-text receipts, source hashes, locator bounds, contradiction states, defensive authority envelopes, and fail-closed tool decisions. Exact-text matching establishes a match in a pinned source span. General semantic entailment, publisher authenticity, and external claim truth need their own evidence. The [evidence guide](docs/EVIDENCE.md) explains these distinctions, and [limitations](docs/LIMITATIONS.md) records unavailable controls and measurements.

Agent Database source checks provide partial evidence for scoped memory, governance, signing, and selected cache behavior. A complete identity system, general authorization, and production persistence remain unverified. Headspace contains five logical language profiles; distinct model identities require actual backend bindings. Its original concurrent fixture failed 12 of 12 cases; the adapter run failed 0 of 12. Both results are retained in the audit trail.

C14 is a newly authored output-level language-analysis reference because the original implementation was missing. Its lexical Jensen-Shannon divergence compares word-frequency distributions. Model logits and internal probabilities remain unavailable. C24 covers bounded local rotor and lattice mechanics under a provisional, non-S0 policy. C08 decoder behavior, C10 repair behavior, and the historical or deprecated C16 surface remain unimplemented in this public reference.

### 4. Revision and release contract

**Design intent.** Corrections create new revisions with explicit preconditions. Earlier receipts and failed runs remain addressable. A release binds its source state, generated artifacts, validation evidence, and replay information so a later reader can distinguish a corrected result from the result it superseded.

**Observed public evidence.** The repository keeps failed cases in declared denominators, including the deliberate combined-overflow configuration among 17 reproducible context configurations. The default suite contains 40 tests. Local scheduler evidence includes eight paired timer observations. Provider latency requires separate measurement. The context experiment definitions are in [experiments/protocol.json](experiments/protocol.json), and statistical helpers for deterministic derived calculations live in [packages/lab/analytics.mjs](packages/lab/analytics.mjs).

The native Tiny model evidence contains 62 passing cases over 20 pinned inputs. The instantiated default Tiny model has 50,060 parameters. The repeated small fixture has **404 parameters**, vocabulary 16, eight lanes, three banks, and seed 2718. This evidence involved zero optimizer steps, learning runs, checkpoint promotions, or hosted provider calls. Generation quality remains unmeasured. The observations support bounded conformance checks.

### Synthetic research-assistant example

Consider a public research task: "Compare two published storage designs and identify which claims are directly supported by their specifications." This example is conceptual. It has not been executed as a validated end-to-end research-assistant workflow.

1. The exact question and two public specifications would be archived with stable source identifiers.
2. A context packet would pin the comparison criteria, retain exact quotations needed for verification, and disclose any truncation or retrieval budget.
3. Separate anchors might cover durability, consistency, failure recovery, and final synthesis. The synthesis anchor would depend on committed parent sections from those analyses.
4. Workers could propose findings such as "Specification A requires quorum acknowledgement." A proposal would remain untrusted until a receipt identifies the exact source span and the claim survives the declared checks.
5. A reviewer could challenge the claim with a conflicting clause. The ledger would retain both relationships and classify the item as supported, contradicted, disputed, or unresolved according to the declared evidence rules. An exact-text match alone would not settle the meaning of conflicting clauses.
6. Completion would publish the bounded artifact and its evidence record under the task's publication authority. A later correction would produce a new revision while preserving the earlier receipt.

A public-safe conceptual artifact might be illustrated as follows:

```json
{
  "anchor": "durability-comparison",
  "requirements": ["compare acknowledged-write guarantees"],
  "sourceIds": ["spec-a", "spec-b"],
  "parentSections": ["definitions"],
  "proposalState": "untrusted",
  "claimStates": ["supported", "unresolved"],
  "completion": "pending-validation"
}
```

This object illustrates field roles only. Consult the actual source contracts for executable APIs and schemas. It does not establish execution of the complete workflow.

### What a full combined experiment would require

The existing combined fixture arm is a reproducible local configuration. A full architecture study would freeze matched model calls, provider revisions, task inputs, dependency DAGs, context budgets, review budgets, completion rules, and a quality rubric before execution. It would account for accepted and rejected review patches, failed calls, retries, cache inclusion, final-response size, evidence coverage, and every unknown usage field.

The study would also need ablations: archive without sparse retrieval, sparse retrieval without dependency routing, routing without review, review without contradiction checks, and the complete guarded path. These arms are proposed experimental controls. A direct baseline would retain its own authority and evidence classifications. Quality would need independent scoring, while cost, tokens, latency, and critical-path speedup would require measurements with defined denominators. The current fixture evidence establishes selected mechanics and reproducibility. Model-quality, cost, speed, novelty, production, and privacy claims require additional evidence.
