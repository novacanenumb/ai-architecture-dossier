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

The preview prints its actual local URL. `dist` is the static publication directory. A public checkout builds from the committed sanitized `component-registry.json`; the original master specification is not required. A local owner with the original specification can regenerate the catalogue with `node scripts/build-catalog.mjs`.

## Evidence and comparison boundaries

Five deterministic fixture arms run on the same history: full context, recent tail, lexical retrieval, sparse exact packing and combined worker routing. UTF-8 packet bytes count headers and duplicated shared inputs. Exact fixture recall checks source spans present in packets. It does not score generated answers.

The default arm is a model-free full-context baseline. Provider token usage, billed cost, model latency, streamed throughput and model quality remain `null`. There is no claim of deterministic hosted generation or demonstrated model noninferiority. Combined routing may increase total bytes; failed arms remain in the denominator and cannot substantiate savings.

The statistics module defines guarded ratios, workflow accounting, seeded paired bootstrap, Unicode MATTR, repeated trigrams, sample coefficient of variation and aligned-support base-2 Jensen–Shannon divergence. Fixed configuration intervals describe that fixture matrix, not a held-out population.

See [limitations](docs/LIMITATIONS.md), [source inventory](docs/SOURCE_INVENTORY.md), [contribution map](docs/CONTRIBUTION_MAP.md), [experiment protocol](experiments/protocol.json), and the generated [results](dist/data/results.json). `experiments/test-receipt.json` is produced only by the host test runner; native proposal receipts do not replace compilation or behavioral tests.

## Structure

```text
packages/lab/       Browser and Node reference mechanisms
tests/              Behavioral and statistical known-vector tests
scripts/            Catalogue, tests, benchmark, build and release checks
dist/               Static site, modules and public evidence
docs/               Attribution, source inventory and limitations
experiments/        Frozen protocol and execution receipts
```

## Reuse and attribution

Original dossier materials use the custom **Novacanenumb Open Design License 1.0** in [LICENSE](LICENSE), permitting commercial and noncommercial reuse with attribution and notices of material changes. No OSI certification is claimed. The separately licensed Hypervisor runtime, private histories, source documents and credentials are excluded from this repository and are not relicensed.

Design programme: novacanenumb. Reference implementation and presentation: AI-assisted, with host integration and executable checks. See [CITATION.cff](CITATION.cff) for attribution metadata.
