# Original native observability evidence

The source-isolated observability suite passed **18 cases**: 14 expanded cases from the unchanged original `tests/test_gtfl_observability.py`, plus four newly authored dossier probes. The original file contains 13 test functions; its full/archive case expands into two cases. There were zero failures, errors or skips. These results provide bounded conformance evidence for recorder coordinates, replay and rejection behavior. They do not measure model quality or observer overhead.

The source owner is `neo-sfr-lab` 0.1.0, with native specification `RTL360-GTFL-NATIVE-1.0`. Eighteen input files are pinned: the previous 15-module native closure, the scalar runtime, the original test file and one historical scalar golden record. Package metadata is hashed separately. The [manifest](../experiments/native-observer/source-manifest.json), [frozen protocol](../experiments/native-observer/protocol.json), [execution receipt](../experiments/native-observer/test-receipt.json) and [interface inventory](../experiments/native-observer/summary.json) retain the exact lineage.

Original module, test and golden-record contents remain outside the public repository. The golden record is loaded locally for one read-only replay test; its contents are neither provided to the proposal worker nor exported. Raw captures, tensor values, controlled original fixture labels and error messages are excluded. Parameterized case labels are replaced with ordinal labels; recorded test names identify behavior without exporting their inputs.

## What the original suite executes

The original tests check the declared observability version, replay order and multiple time bases. Checkpoint records carry exact fraction fields and reject boolean substitution for integers. Scalar execution and replay preserve the checkpoint contract.

The tampering cases recompute affected roots and crosslinks before invoking replay or verification. They test changed checkpoint coordinates, reordered events, an unknown event, omission of a pulse stage, native event-coordinate changes and a changed observability contract. Rejection after re-signing gives bounded evidence of semantic crosslink and contract checks rather than only detection of a changed digest. It does not prove a general semantic validator or authenticated publisher.

Scalar failure cases retain a structured critical ledger while issuing no successful collapse authority. Admission without a critical-ledger reservation is rejected. Native cases inspect the exact checkpoint and event fields for both full capture and archive capture, and reject re-signed top-level time changes. The historical scalar record is replayed read only by the current verifier; the archived producer is not executed.

These are separately observed original-source cases. The source describes some of them as independent checks, but this dossier makes no claim that a new independent human or external organization reproduced the results.

## Four new public contract probes

The public [probe module](../experiments/native-observer/probe.py) checks four additional behavior boundaries:

1. Two calls to `observability_contract` return separate dictionaries and nested lists. Mutating one caller's dictionary, replay order and time bases leaves the other return value unchanged.
2. Events in the same capsule, source epoch and frame retain the same logical clock even when token coordinates or the named source change. The clock starts at zero.
3. Changing the frame and then the source epoch increments the clock at each transition. Source-epoch identities change with the epoch index and reproduce for the same inputs.
4. Boolean, fractional, string and negative values are rejected for the tested integer coordinates. A null token index remains a permitted value.

The invalid-value loops are assertions within one test case; they are not counted as independent trials. The four new tests issue no inference calls, training, network, subprocess or storage requests.

The native Hypervisor source proposal required a parent correction from the nonexistent `rtl360_gtfl.observer` import to the observed `rtl360_gtfl.observability` owner. The corrected source was submitted and structurally validated before execution. Formatting changes and that correction are recorded. A request preflight initially omitted its requirement-to-anchor linkage and was rejected with `UNREPRESENTED_REQUIREMENT`; no task session was created by that rejection. The corrected request produced one actual Sol proposal turn and a closed ephemeral reported result.

## Why observer overhead remains unavailable

The recorded inventory contains the actual configuration field names and `infer_token` argument names. The inspected configuration has capture-byte limits but no telemetry-disabled selector; the inspected inference method has an optional archive argument. Both supported capture paths emit observability data. This inspection is bounded to that pinned configuration and method, rather than a claim that no alternative API could exist anywhere.

A full-capture versus archive comparison measures different representation and storage paths. It cannot isolate the cost of turning the observer on. Consequently **C26-T05 remains NOT_RUN**, with `observerOverheadMs: null` and `telemetryOffComparison: false`. No speedup, zero overhead, token saving or cost saving is inferred from these 18 passes.

The earlier [native archive study](NATIVE_ARCHIVE_EVIDENCE.md) remains a separate experiment. Its eight full/archive pairs returned smaller JSON but incurred longer timed inference. Its frozen observations and bootstrap remain unchanged by this suite.

## Acceptance and remaining coverage

The replay and re-signed tamper rejection cases contribute **partial C28-T02 and C28-T03 evidence**. Their scope is local scalar/native record verification; they do not cover every exported artifact, every external effect or all hosted providers. C22, C26 and C27 receive additional recorder-mechanism evidence without new acceptance passes being inferred from the test count.

Provider token accounting, cancellation denominators, complete metric formula coverage, held-out learning, checkpoint promotion and telemetry-disabled overhead require their own experiments. The suite does not increase the number of components claimed fully implemented. All 154 hosted comparison endpoints remain null, and the combined Hypervisor versus standalone model comparison remains unmeasured.

## Reproduce and inspect

Run `npm run test:native-observer` with Node 26, the exact source pins and the recorded Python environment. Python 3.12, Torch 2.14.0, NumPy 2.5.3 and safetensors 0.8.0 come from the existing native environment; pytest 9.1.1 is appended from the read-only Agent Database environment. No package is installed.

The runner verifies the approved Hypervisor dependency, copies selected original bytes into an owned temporary directory, executes the original suite and new probes there, and rechecks source hashes afterward. The observed receipt confirms source bytes unchanged and temporary-copy removal. Its Python audit hook rejects network, subprocess creation and outside writes on a BEST_EFFORT basis. Operating-system subprocess confinement remains UNAVAILABLE. This boundary is separate from the platform's tool permissions.

The optional source run performs no optimizer update, training job, external checkpoint load, legacy launcher or hosted-provider call. The public golden input hash does not grant permission to redistribute its contents. The default public lab continues to run without the original source or native runtime; release verification checks the retained sanitized evidence without rerunning private-source tests.

Browser controls select frozen original or new cases. They inspect stored outcomes and interface names; they do not execute the original neural model in the browser. DOM-interface checks are separate from rendered visual QA, which remains unavailable in this environment.
