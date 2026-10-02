# Source inventory

Inspection date: 2026-10-03 Australia/Brisbane.

Inspected local sources: `../CODEX_START.md` (implementation handoff), `../MASTER_SPEC.md` (HYP-PORTFOLIO-1.0, 28 component specifications), and `../HYPERVISOR-2.1-STABLE` (2.1.0 project dependency). The installed desktop plugin reports native runtime 2.1, protocol 2.0, schema 2 and verified packaged content.

The workspace initially contained these two documents and the dependency directory. The referenced component-registry.json, acceptance_matrix.csv, shared schema examples, component files and historical source repositories were absent. The master specification is the source for a new derived catalogue; it is not proof that historical code has been inspected.

Historical figures such as 147 tests, 16/16 fixture needles and 95.758 percent byte reduction are reported by the source specification. They are not current measurements and are excluded from headline performance claims.

The dependency release status identifies locally verified core with experimental dialect, unavailable general semantic validation, unsigned publisher status and unverified live quality/cost. File integrity does not authenticate a publisher.

The supplied `HYPERVISOR-2.1-STABLE` implementation has now been inspected beyond its release metadata. The probes in `experiments/runtime/tests/` execute five owning modules: `02_CONTEXT_PLANE/context.mjs`, `03_GENERATION_PLANE/generation.mjs`, `05_TOOL_AND_AUTHORITY_PLANE/broker.mjs`, `06_EVIDENCE_PLANE/evidence.mjs` and `07_PERFORMANCE_PLANE/performance.mjs`. Their shared canonicalization module was also inspected. The exact module hashes and dependency manifest/root hashes are retained in `experiments/runtime/test-receipt.json`. All 85 manifest members were verified before imports. These are actual 2.1.0 modules, not reconstructed historical source.

The 23 new probes passed with zero failures or skips on Node v26.3.1 / Windows. They provide partial mechanism evidence for C02, C03, C06, C09, C19, C21 and C27. The acceptance mapping includes explicit exclusions; it does not certify all 122 scenarios. See [supplied runtime evidence](RUNTIME_EVIDENCE.md).

The historical `.HYPERVISOR-V2.0` build was located and its package metadata and test filenames inspected. Its package identifies `2.0.0+standalone.20260912.1`, and its test script is `node --test --test-isolation=none tests/*.test.mjs`. That older test suite was not executed under the required 2.1 operating policy. Locating it does not reproduce the reported 147-test result. A deprecated standalone tree also exists; its source conventions were inspected, but its code was not executed or merged into this dossier.

No private conversation archives, credentials or profile datasets are included. Public demonstrations use generated synthetic histories. Original source documents remain outside the publication checkout.
