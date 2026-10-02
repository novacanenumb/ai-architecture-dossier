import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const specPath = path.resolve(root, '../MASTER_SPEC.md');
const spec = await readFile(specPath, 'utf8').catch(async error => {
  if (error.code !== 'ENOENT') throw error;
  const registry = JSON.parse(await readFile(path.join(root, 'component-registry.json'), 'utf8'));
  if (registry.schemaVersion !== 1 || registry.components?.length !== 28 || !/^[a-f0-9]{64}$/.test(registry.sourceDigest)) throw new Error('Invalid public registry');
  await mkdir(path.join(root, 'dist/data'), { recursive: true });
  await writeFile(path.join(root, 'dist/data/catalog.json'), JSON.stringify(registry, null, 2) + '\n');
  console.log(JSON.stringify({ mode: 'public-registry', components: registry.components.length, sourceDigest: registry.sourceDigest }));
  process.exit(0);
});
const lines = spec.split(/\r?\n/);
const clean = text => String(text ?? '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[`*_]/g, '').trim();
const starts = lines.map((text, i) => ({ text, i, m: /^### (C\d{2}) — (.+)$/.exec(text) })).filter(x => x.m);
if (starts.length !== 28) throw new Error('Expected exactly 28 component specifications');
const components = starts.map(({ m, i }, ordinal) => {
  const end = starts[ordinal + 1]?.i ?? lines.findIndex((line, n) => n > i && /^## 8\./.test(line));
  const body = lines.slice(i + 1, end).join('\n');
  const section = name => {
    const marker = `**${name}.**`;
    const begin = body.indexOf(marker);
    if (begin < 0) return '';
    const remainder = body.slice(begin + marker.length);
    const next = remainder.search(/\n\*\*(?:[A-Z][^\n]*?)\*\*/);
    return clean((next < 0 ? remainder : remainder.slice(0, next)).replace(/\n\n+/g, '\n\n'));
  };
  const acceptance = [...body.matchAll(/`(C\d{2}-T\d{2})` — ([^\n]+)/g)].map(x => ({ id: x[1], text: clean(x[2]), result: 'NOT_RUN', testFile: null }));
  const metricsLine = body.match(/\*\*Metrics\.\*\* ([^\n]+)/)?.[1] ?? '';
  const sources = [...new Set((body.match(/\*\*Sources:\*\*([^\n]+)/)?.[1] ?? '').match(/S\d{2}/g) ?? [])];
  const sourceStatus = clean(body.match(/\*\*Prior-source status:\*\* (.*?)(?= \*\*This handoff:)/)?.[1]);
  return { id: m[1], title: m[2], layer: body.match(/\*\*Layer:\*\* `([^`]+)`/)?.[1] ?? 'unknown',
    sourceStatus, implementationStatus: ['C02','C03','C27'].includes(m[1]) ? 'reference_slice' : 'specified_not_implemented_here', evidenceStatus: 'unverified_until_test_run',
    dependencies: (body.match(/\*\*Dependencies:\*\*([^\n]+)/)?.[1] ?? '').match(/C\d{2}/g) ?? [], sources,
    purpose: section('Purpose'), design: section('Design'), improvement: section('Intended improvement'), claimBoundary: section('Claim boundary'),
    lab: section('Standalone lab'), firstDeliverable: section('First deliverable'), acceptance, metrics: [...metricsLine.matchAll(/`([^`]+)`/g)].map(x => x[1]),
    lineage: { document: 'MASTER_SPEC.md', specificationId: 'HYP-PORTFOLIO-1.0', startLine: i + 1, endLine: end, originalSourceInspection: 'not established by this derived specification' } };
});
if (components.some((c, i) => c.id !== `C${String(i + 1).padStart(2, '0')}`)) throw new Error('Component sequence mismatch');
const catalogue = { schemaVersion: 1, author: 'novacanenumb', title: 'AI Architecture Dossier', sourceDigest: createHash('sha256').update(await readFile(specPath)).digest('hex'),
  inventoryGaps: ['component-registry.json absent from supplied package', 'acceptance_matrix.csv absent from supplied package', 'historical repositories and original private design documents not inspected'],
  components };
await mkdir(path.join(root, 'dist/data'), { recursive: true });
await writeFile(path.join(root, 'dist/data/catalog.json'), JSON.stringify(catalogue, null, 2) + '\n');
await writeFile(path.join(root, 'component-registry.json'), JSON.stringify(catalogue, null, 2) + '\n');
console.log(JSON.stringify({ components: components.length, acceptanceRequirements: components.reduce((s, c) => s + c.acceptance.length, 0), metrics: components.reduce((s, c) => s + c.metrics.length, 0), sourceDigest: catalogue.sourceDigest }));
