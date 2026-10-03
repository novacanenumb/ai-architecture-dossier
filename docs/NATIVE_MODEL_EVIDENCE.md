# Native model conformance evidence

The dossier now records an executed source-level study of C23 RTL360-GTFL, C25 native record binding, and C26 exact-forward mechanics. The observed source is `neo-sfr-lab` 0.1.0, package `rtl360_gtfl`, under specification `RTL360-GTFL-NATIVE-1.0`. The final isolated run passed **62 cases: 58 original cases and four new dossier probes**, with no failures, errors, or skips. This supplies partial acceptance evidence; it does not establish a trained language model or an efficiency advantage over standalone models.

The [source manifest](../experiments/native-model/source-manifest.json) pins 15 modules, three original test files, and two canonical compiler inputs. Package metadata is hashed separately. The parent runner copies those 20 inputs into an owned temporary directory, verifies the original hashes afterward, and removes the checked copy. Original source, compiler text, weights, hidden states, and private test payloads are excluded from public distribution. The original project's legacy 0.2.x launcher and gate were neither executed nor modified.

The public [protocol](../experiments/native-model/protocol.json), [test receipt](../experiments/native-model/test-receipt.json), and [derived summary](../experiments/native-model/summary.json) bind the experiment to source hashes, execution settings, collected cases, and output hashes. Original parametrized labels are replaced with case ordinals to prevent private fixture text from entering public records.

## Actual tensors and configured counts

The default Tiny model was instantiated with **50,060 parameters**. Its six actual tensor families contain: codebook 16,384; relations 32,768; kappa 512; u_alpha 192; u_beta 192; and eta 12. Their sum equals both the model's reported count and its configuration count. A smaller reproducibility fixture has 404 instantiated parameters, vocabulary size 16, eight positive-state lanes, and three occupied threshold banks.

The reference 25-million configuration reports **25,005,068 parameters**, but it was compiled and inspected without allocating those tensors. A configuration formula does not prove that the larger model was instantiated, trained, or evaluated. Fresh synthetic initialization was used throughout; no external checkpoint, optimizer step, training job, or provider request ran.

The module inventory contains `RTL360GTFLModel` and none of the tested forbidden Torch module classes: Linear, MultiheadAttention, LayerNorm, GELU, or Softmax. This is a bounded module check. Functional operators can exist outside a registered module inventory, so it cannot establish the full C23 semantic-graph exclusion requirement.

## Source behavior under test

The original model suite contributes 13 cases; the independent reference contributes 28 expanded cases; native lowering contributes 17. The scalar and Fraction oracle has no production-model or Torch import. Tests compare its bounded bank computations and tied readout against the actual tensor path, including equal winners, zero domains, failed generations, and invalid mixtures.

Other checks exercise immutable causal records, duplicate imports, exact capsule mass, checkpoint chains, staged semantic claims, issued seals, and rejection of tampered or unsupported compiler declarations. A finite backward pass and compact forward-training computation run without a parameter update. They demonstrate tested gradient and forward mechanics, not convergence or generalization. An in-memory state-dictionary reload checks fresh Tiny compatibility; it does not demonstrate durable checkpoint promotion.

Four new probes check allocated parameter counts and partial module inventory, same-seed reproducibility without parameter changes, record invalidation after an in-domain codebook change, and rejection of cross-sequence/current-time imports and unsupported S3L memory. Matching hashes come from two fresh copies of the same synthetic fixture. They are not sampled-model quality statistics or an executed dense baseline.

## Preserved failures

Three earlier attempts remain under `experiments/native-model/history/`. Two attempts passed 57 of 62 cases: the runner omitted two compiler inputs, and the new probe assumed `record` rather than the actual `crsc_record` field. After those corrections, 61 cases passed; the codebook mutation exceeded the permitted numeric domain before the intended root-binding check. Changing the fresh fixture to another valid value allowed that check to run. No original source was edited to obtain a pass.

## Acceptance scope

| Acceptance | Observed scope |
| --- | --- |
| C23-T01, T02, T04, T05 | Partial compiler/module, causal, zero-domain, and actual Tiny-count evidence |
| C23-T03 | NOT_RUN: held-out learning versus trivial baselines |
| C25-T01, T02 | Partial parameter-root, sequence, time, and issued-seal evidence; tokenizer binding and human identity remain unverified |
| C25-T03, T04 | NOT_RUN: CRSC eviction/recomputation and missing-archive recovery |
| C26-T02, T03 | Partial frozen forward, finite backward, and numerical failure evidence |
| C26-T01, T04, T05 | NOT_RUN: held-out learning, checkpoint promotion, and observer-overhead measurement |

## Reproduction and controls

Run `npm run test:native-model` with Node 26 and separately available pinned source. The runner uses existing Python 3.12, Torch 2.14.0, NumPy 2.5.3, safetensors 0.8.0, and an explicitly appended read-only pytest 9.1.1 library. It installs nothing. CPU thread counts are one, CUDA is disabled, plugin autoload and bytecode writes are disabled, and temporary writes remain within the owned copy. The full approved Hypervisor 2.1 dependency is verified first.

The Python audit hook rejects network, subprocess, and outside-copy writes on a BEST_EFFORT basis. Operating-system confinement remains UNAVAILABLE. All 154 hosted-model endpoints remain null. Tokens, billed cost, hosted latency, learning quality, and the combined-Hypervisor versus standalone-model comparison cannot be inferred from these local source tests.
