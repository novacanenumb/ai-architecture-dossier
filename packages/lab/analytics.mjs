const finite = (n, name) => { if (typeof n !== 'number' || !Number.isFinite(n)) throw new TypeError(`${name} must be finite`); return n; };
const positive = (n, name) => { finite(n, name); if (n < 0) throw new RangeError(`${name} must be nonnegative`); return n; };
const count = (n, name) => { if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`${name} must be a nonnegative integer`); return n; };
export function safeRatio(numerator, denominator) { return typeof numerator === 'number' && Number.isFinite(numerator) && typeof denominator === 'number' && Number.isFinite(denominator) && denominator !== 0 && Number.isFinite(numerator / denominator) ? { value: numerator / denominator, reason: null } : { value: null, reason: 'zero or missing denominator or nonfinite input' }; }
export function reductionRatio(baseline, candidate) { positive(baseline, 'baseline'); positive(candidate, 'candidate'); return baseline ? { value: 1 - candidate / baseline, reason: null } : { value: null, reason: 'baseline is zero' }; }
export function tokenAmplification(generated, accepted) { count(generated, 'generated'); count(accepted, 'accepted'); if (generated < accepted) throw new RangeError('accepted exceeds generated'); return safeRatio(generated, accepted); }
export function acceptedTPS(accepted, seconds) { count(accepted, 'accepted'); positive(seconds, 'seconds'); return { ...safeRatio(accepted, seconds), unit: 'accepted_tokens/second' }; }
export function aggregateUsage(calls) {
  if (!Array.isArray(calls)) throw new TypeError('calls must be array');
  const fields = ['inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens', 'cacheWriteTokens', 'cost'];
  const totals = {}, coverage = {};
  for (const call of calls) {
    if (!call || typeof call !== 'object') throw new TypeError('invalid call');
    for (const field of fields) if (call[field] != null) field === 'cost' ? positive(call[field], field) : count(call[field], field);
    if (call.cachedInputTokens != null && call.inputTokens != null && call.cachedInputTokens > call.inputTokens) throw new Error('cached input is subset of input');
    if (call.reasoningTokens != null && call.outputTokens != null && call.reasoningTokens > call.outputTokens) throw new Error('reasoning is subset of output');
  }
  for (const field of fields) { coverage[field] = calls.filter(c => c[field] != null).length; totals[field] = calls.length && coverage[field] === calls.length ? calls.reduce((s, c) => s + c[field], 0) : null; }
  return { callCount: calls.length, totals, coverage, totalModelTokens: totals.inputTokens != null && totals.outputTokens != null ? totals.inputTokens + totals.outputTokens : null, semantics: 'cached input and reasoning are subsets; all failed/retry/review calls included; no duplicated subtotals' };
}
export function aggregateCosts(entries) {
  if (!Array.isArray(entries)) throw new TypeError('entries must be array');
  const seen = new Set(), byCategory = {}; let total = entries.length ? 0 : null;
  for (const e of entries) { if (!e.id || seen.has(e.id) || !e.category) throw new Error('unique charge id and category required'); seen.add(e.id); if (e.cost == null) { total = null; byCategory[e.category] = null; continue; } positive(e.cost, 'cost'); if (total != null) total += e.cost; if (byCategory[e.category] !== null) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.cost; }
  return { total, byCategory };
}
function random(seed) { let state = seed >>> 0; return () => { state = (state + 0x6D2B79F5) >>> 0; let x = Math.imul(state ^ state >>> 15, state | 1); x ^= x + Math.imul(x ^ x >>> 7, x | 61); return ((x ^ x >>> 14) >>> 0) / 4294967296; }; }
const percentile = (values, p) => { const index = (values.length - 1) * p, lo = Math.floor(index), hi = Math.ceil(index); return values[lo] + (values[hi] - values[lo]) * (index - lo); };
export function pairedBootstrap({ baseline, candidate, iterations = 2000, confidence = .95, seed = 1 }) {
  if (!Array.isArray(baseline) || !Array.isArray(candidate) || baseline.length !== candidate.length || baseline.length < 2) throw new Error('at least two aligned task pairs required');
  baseline.forEach(n => finite(n, 'baseline')); candidate.forEach(n => finite(n, 'candidate'));
  count(iterations, 'iterations'); if (iterations < 1 || iterations > 100000) throw new RangeError('iterations outside 1..100000');
  if (!Number.isSafeInteger(seed)) throw new TypeError('integer seed required');
  if (!(confidence > 0 && confidence < 1)) throw new RangeError('confidence outside (0,1)');
  const differences = candidate.map((n, i) => n - baseline[i]), rng = random(seed), samples = [];
  for (let k = 0; k < iterations; k++) { let total = 0; for (let i = 0; i < differences.length; i++) total += differences[Math.floor(rng() * differences.length)]; samples.push(total / differences.length); }
  samples.sort((a, b) => a - b);
  return { meanDifference: differences.reduce((s, n) => s + n, 0) / differences.length, interval: [percentile(samples, (1 - confidence) / 2), percentile(samples, 1 - (1 - confidence) / 2)], sampleSize: differences.length, confidence, iterations, seed, method: 'task-paired percentile bootstrap; candidate minus baseline' };
}
export function tokenize(text) { if (typeof text !== 'string') throw new TypeError('text required'); return text.toLocaleLowerCase('en-US').match(/[\p{L}\p{M}\p{N}]+(?:['’][\p{L}\p{M}\p{N}]+)*/gu) ?? []; }
export function mattr(text, window = 50) { count(window, 'window'); if (!window) throw new RangeError('positive window required'); const t = tokenize(text); if (t.length < window) return { value: null, reason: 'insufficient tokens for fixed window', window, tokens: t.length }; let total = 0; for (let i = 0; i <= t.length - window; i++) total += new Set(t.slice(i, i + window)).size / window; return { value: total / (t.length - window + 1), reason: null, window, tokens: t.length, tokenizer: 'Unicode words, internal apostrophes, en-US lowercase' }; }
export function repeatedTrigramRate(text) { const t = tokenize(text), total = Math.max(0, t.length - 2), grams = new Map(); for (let i = 0; i < total; i++) { const key = JSON.stringify(t.slice(i, i + 3)); grams.set(key, (grams.get(key) ?? 0) + 1); } const repeats = [...grams.values()].reduce((s, n) => s + n - 1, 0); return { ...safeRatio(repeats, total), repeatedBeyondFirst: repeats, totalOccurrences: total }; }
export function sampleCV(values) { if (!Array.isArray(values)) throw new TypeError('array required'); values.forEach(n => finite(n, 'sample')); if (values.length < 2) return { value: null, reason: 'at least two observations required' }; const mean = values.reduce((s, n) => s + n, 0) / values.length; if (!mean) return { value: null, reason: 'mean is zero' }; const variance = values.reduce((s, n) => s + (n - mean) ** 2, 0) / (values.length - 1); return { value: Math.sqrt(variance) / Math.abs(mean), reason: null, mean, sampleSize: values.length, convention: 'sample standard deviation' }; }
export function sentenceCV(text) { const lengths = (text.match(/[^.!?]+(?:[.!?]+|$)/g) ?? []).map(s => tokenize(s).length).filter(Boolean); return { ...sampleCV(lengths), sentenceCount: lengths.length, segmentation: 'terminal . ! ? punctuation; abbreviations not modeled' }; }
export function jensenShannon(p, q, { tolerance = 1e-9 } = {}) {
  finite(tolerance, 'tolerance'); if (tolerance < 0 || tolerance > .001) throw new RangeError('invalid tolerance');
  if (!Array.isArray(p) || !Array.isArray(q) || !p.length || p.length !== q.length) throw new Error('same nonempty aligned support required');
  const normalize = a => { a.forEach(n => positive(n, 'probability')); const sum = a.reduce((s, n) => s + n, 0); if (!sum || Math.abs(sum - 1) > tolerance) throw new Error('probabilities must sum to one'); return a.map(n => n / sum); };
  const pn = normalize(p), qn = normalize(q), midpoint = pn.map((n, i) => (n + qn[i]) / 2);
  const kl = a => a.reduce((s, n, i) => n ? s + n * Math.log2(n / midpoint[i]) : s, 0);
  return { value: (kl(pn) + kl(qn)) / 2, unit: 'bits', base: 2, supportSize: p.length, reason: null };
}
