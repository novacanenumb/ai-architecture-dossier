# Native archive evidence

The source-isolated native archive study passed **30 cases**: 26 expanded cases from the unchanged original `tests/test_gtfl_archive_model.py` and four new dossier probes. The original file defines 17 test functions. The source owner is `neo-sfr-lab` 0.1.0 under `RTL360-GTFL-NATIVE-1.0`. Sixteen inputs are pinned: 15 modules and the original test file, with package metadata hashed separately. Original hashes matched before and after execution, and the owned copy was removed.

Public records include the [source manifest](../experiments/native-archive/source-manifest.json), [frozen protocol](../experiments/native-archive/protocol.json), [test receipt](../experiments/native-archive/test-receipt.json), [sanitized observations](../experiments/native-archive/summary.json), and [derived comparisons](../experiments/native-archive/results.json). The released code contains the new probes and runners. Original source, raw captures, tensor values, controlled test literals and private fixture markers are excluded.

## Original behavior and new probes

The original suite checks full-capture and archive semantics, read-only reopen, resolver substitution, and rejection of tampered, missing, extra, nonregular and linked objects. Budget, time and atomic-failure cases verify that the tested failed capture does not issue import authority. The suite also checks causal-context and default-Tiny parity, explicitly bounded deadlines, warmed-cache rejection of invalid or re-signed claims, and bounded digest-string storage. All 26 expanded original cases passed with zero failures, errors or skips.

Four new public synthetic probes passed. They compare shared full/archive semantics; forbid model inference while reopening and materializing the archive; delete a generated referenced object and verify immediate reopening rejection; and mutate returned snapshots and resolved payloads to check that stored state remains unchanged.

The actual archive API exposes `snapshot` as a property. `full_frame` and `full_event` expand summaries through their `archive_ref`. Generated object filenames bind the reference's SHA-256 digest. A missing referenced object makes `open` reject the archive; it does not construct substitute history. Original-source link rejection and the owned-copy audit boundary are separate controls.

Read-only reopen supplies bounded local verification and reuse. Remote durability, human identity, publisher authenticity and disaster recovery remain unverified. The bounded digest-hash cache is separate from native Collapsed Route-State Cache eviction. **C25-T03 remains NOT_RUN.** Missing generated-object rejection supplies partial C25-T04 evidence only; it does not establish general recovery from a missing CRSC entry.

## Matched representation experiment

Eight paired cases produced 16 measured arms, preceded by two separately recorded warmups. All 18 requested measurement inference calls were recorded and fulfilled. All eight pairs passed the shared-semantics and reopen gate. Original-suite inference calls are not counted by this measurement protocol and remain unavailable as a public aggregate.

Each arm instantiates a fresh CPU Tiny model with **404 parameters**, vocabulary 16, eight lanes, three banks and seed 2718. Token ID is 3 and token time is 0. Each pair uses the same public capsule for both arms. Order alternates full-first and archive-first. The baseline is `full_capture_v1`; the candidate is `sealed_archive_v2`. No parameters are optimized and no checkpoint is loaded.

The timer covers `infer_token` only, including capture, hashing and sealing performed within that call. Model allocation, directory preparation, semantic expansion, comparison-hash calculation, reopening and byte enumeration occur outside the timer. Both arms emit telemetry. The experiment therefore leaves **C26-T05 observer overhead NOT_RUN** because it has no telemetry-off arm.

Shared normalized distribution, CRSC record, collapse record, three frames and 37 events match in every pair. The exported evidence contains hashes and counts rather than those raw records. This gate checks local synthetic semantic representation; it does not evaluate language quality.

| Measure | Full capture | Sealed archive |
| --- | ---: | ---: |
| Mean timed inference | 17.7544 ms | 266.3227875 ms |
| Returned JSON per measured arm | 127,755 bytes | 110,046 bytes |
| Stored archive plus observed timing sidecar | null | 190,515 bytes |

The archive returned **13.8617% fewer JSON bytes** in this matched serialization, while timed inference was approximately **15.0004 times longer**. The returned payload reduction is separate from total storage or memory efficiency: the archive adds objects and metadata on disk. The baseline creates no disk artifact, so its stored-byte field is null and no cross-format disk compression ratio is reported.

Candidate storage includes every sealed object, capture, manifest and seal, plus an observed timing sidecar outside the sealed semantic directory. That sidecar contributes 7,356 bytes in each recorded arm; the complete footprint contains 44 files. This accounting avoids omitting the timing or manifest costs from the candidate.

## Statistical interpretation

The paired candidate-minus-baseline mean difference is **248.5683875 ms**, with a 95% percentile-bootstrap interval of **[243.029335, 255.63211375] ms**. The calculation uses the existing analytics owner, 4,000 iterations and seed 1729. Frozen observations and arithmetic reproduce deterministically. Fresh wall-clock observations may vary across machines and runs.

All eight pairs remain in the declared denominator. There are eight eligible pairs, zero excluded pairs and zero failed measured arms. Warmups are retained separately. Future failed arms must remain recorded; ratios and intervals require their declared gates and denominators. This finite, repeated synthetic workload supplies local timing evidence rather than an independent population of model tasks.

## Reproduction and authority

Run `npm run test:native-archive` with Node 26 and the exact pinned sources. The existing Python 3.12 environment provides Torch 2.14.0, NumPy 2.5.3 and safetensors 0.8.0; the runner appends the read-only AgentDB pytest 9.1.1 location and installs nothing. `npm run derive:native-archive` recomputes statistics from retained observations without executing original source. `npm run test:native-archive:analytics` checks failure accounting and derivation guards.

The runner verifies the approved Hypervisor dependency and all source pins, copies only selected files into an owned temporary root, rechecks original hashes, and checks the cleanup path. Owned link entries are unlinked without following their targets before checked recursive cleanup. The Python audit hook rejects network, subprocess creation and writes outside that copy on a BEST_EFFORT basis. Operating-system confinement remains UNAVAILABLE.

The earlier native proposal session timed out after two host turns and no accepted submission; its closed failure record is retained. The new guide receives native nonempty, schema, anchor and GTFL structural checks, with parent source execution and statistical checks recorded separately. No independent general semantic validator is claimed.

This study executes no optimizer, training job, external checkpoint, legacy launcher or hosted provider. All 154 hosted model endpoints remain null. Model quality, provider tokens, billed cost, hosted latency and full combined-versus-standalone comparisons remain unavailable.
