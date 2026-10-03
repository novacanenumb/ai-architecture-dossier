# C24 rotor and lattice source evidence

The dossier now records an executed mathematical mechanics study of `neo-sfr-lab` 0.1.0, its `rtl360_gtfl` package and specification identifier `RTL360-GTFL-NATIVE-1.0`. The suite passed **nine original tests** and **six additional dossier probes**, with no failures, errors or skips. It supplies partial C24 evidence; model generation, learned quality and the broader C23–C26 acceptance requirements remain unverified.

The [source manifest](../experiments/rotor/source-manifest.json) pins seven files: six pure-math modules (`__init__`, `canonical`, `numeric`, `config`, `rotor`, `lattice`) and the original rotor/lattice test file. Package metadata is hashed separately. The runner copies only those seven files into an owned temporary directory, executes there, rechecks the original hashes and removes the copy. Original source is not redistributed. The separately owned legacy `rlt360_core` model, project launcher, training jobs, model weights and checkpoints are excluded.

## Mathematical surface

The frozen fixture uses a full turn of 360,000 phase units, support ceiling 16,777,215, three axles and harmonics 1, 2, 4 and 8. These are integer computations in the original modules. Configuration arithmetic, including a parameter-count formula, does not establish that a neural tensor set was instantiated or trained.

`route_imports` belongs to the lattice module. Records declare `record_hash`, `token_time`, `lattice_cell`, `rotor_phases` and `source_roots`. An arrival can carry `LOCAL_WINDOW`, `SAME_ANCESTOR` or `ROTOR_RAY_INTERSECTION` classifications. Its arrival ceiling is the minimum of resonance and recency support. The public fixture permits at most 16 input records and eight cells per ray; it produces three axle rays.

The local-window requirement covers provided records whose time difference is one through eight. It does not require every older candidate to be admitted. Candidate order is retained, and the helper's declaration has no sequence identity or permission contract. Current/future rejection therefore supplies a causal boundary without proving cross-sequence privacy, source authorization or non-disclosure.

## Executed tests and traces

The [receipt](../experiments/rotor/test-receipt.json) retains all 15 expanded test results. The nine original cases cover four axle counts (two through five), three Hilbert depths (one through three), fixed prototype mass with explicit provisional policy, and bounded integer DDA traversal with simultaneous axis ties. The six added probes check repeated results and hashes, input immutability, import-domain overflow rejection, current/future rejection, malformed phase shape and Boolean hidden-value rejection, local-window recall and support/ray bounds, and detached returned source-root lists. Several assertions share one test function; the additional test denominator remains six.

The [protocol](../experiments/rotor/protocol.json) was frozen before execution. The [public trace](../experiments/rotor/trace.json) records four synthetic cases at times 2, 10, 33 and 65, each routed twice. All eight calls are accounted for. Every repeated result matches its first result and canonical hash; each required local record is delivered, and caller inputs remain unchanged. No route call failed and no case was excluded.

Each case includes its public inputs, first result and counts. `canonicalJsonBytes` measures the case before that count field is added, using sorted compact UTF-8 JSON. It excludes provider framing and is not a token, billing or throughput measurement. The receipt binds the complete trace file by byte count and SHA-256. Canonical result hashes were computed by the original Python CBOR implementation; the portable verifier checks file integrity and recorded equalities without claiming to execute that CBOR algorithm independently.

| Acceptance requirement | Evidence and remaining boundary |
| --- | --- |
| C24-T01 | Partial: exact fixed-point rotor boundaries, Hilbert geometry and bounded ray mechanics |
| C24-T02 | Not run: camera or observer isolation |
| C24-T03 | Partial: current/future imports reject; cross-sequence identity remains unverified |
| C24-T04 | Not run: no matched-budget dense/sparse semantic comparison |

The routing policy remains `PROPOSED_LOCAL_MECHANICS_NOT_S0` with ordering `skilling_hilbert_gray_3d_v1`. Passing local tests does not promote that policy. A visual projection has no demonstrated physical-neuron interpretation.

## Reproduction and authority

```text
npm run test:rotor
```

The optional runner requires Node 26, Python 3.12 and pytest 9.1.1, plus the exact original source and approved dossier dependency. `ROTOR_SOURCE_PATH`, `DOSSIER_PYTHON_PATH` and `DOSSIER_RUNTIME_PATH` select those locations. Default public tests and static builds use the frozen evidence and do not execute the optional source suite.

The Python audit hook rejects network, subprocess creation and writes outside the owned copy on a **BEST_EFFORT** basis. Its environment disables plugin autoload and bytecode writes and places temporary files inside that copy. Operating-system confinement remains unavailable. The original project's legacy 0.2.x launcher/gate is neither invoked nor changed; the dossier uses its separately verified Hypervisor 2.1 dependency.

History retains a native task timeout and a dependency preflight failure. The latter stopped before Python execution when the dossier's bundled Node binary failed its locked hash. The mismatched copy was preserved locally, then the verified release installer restored the identical approved release without changing the lock. The successful suite follows that repair. Hosted usage, cost, latency, default-model quality, training and checkpoint results remain null.
