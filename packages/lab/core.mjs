const encoder = new TextEncoder();
const copy = value => structuredClone(value);
const integer = (value, name, min = 0, max = 1000000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new RangeError(`${name} outside ${min}..${max}`);
  return value;
};
const toBytes = value => {
  if (typeof value === 'string') return encoder.encode(value);
  if (value instanceof Uint8Array) return value.slice();
  throw new TypeError('content must be text or Uint8Array');
};
export const stableJSON = value => Array.isArray(value) ? `[${value.map(stableJSON).join(',')}]` :
  value && typeof value === 'object' ? `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stableJSON(value[k])}`).join(',')}}` : JSON.stringify(value);
export async function sha256(value) {
  const data = toBytes(value);
  if (globalThis.crypto?.subtle) return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', data)), b => b.toString(16).padStart(2, '0')).join('');
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(data).digest('hex');
}

// This reference store is in-memory. Each source belongs to one explicit scope.
// It is a local demo mechanism, not an authenticated multi-user server.
export class ExactArchive {
  #records = new Map();
  #authorize;
  constructor({ authorize = scope => scope === 'public' } = {}) { this.#authorize = authorize; }
  #read(id, scope, operation) {
    if (!this.#authorize(scope, operation, id)) throw Object.assign(new Error('UNAUTHORIZED_SCOPE'), { code: 'UNAUTHORIZED_SCOPE' });
    const record = this.#records.get(id);
    if (!record || record.scope !== scope) throw Object.assign(new Error('NOT_FOUND'), { code: 'NOT_FOUND' });
    return record;
  }
  async append({ id, content, scope = 'public', metadata = {} }) {
    if (typeof id !== 'string' || !id) throw new TypeError('source id required');
    if (!this.#authorize(scope, 'append', id)) throw new Error('UNAUTHORIZED_SCOPE');
    if (this.#records.has(id)) throw new Error('SOURCE_ALREADY_EXISTS');
    const data = toBytes(content), digest = await sha256(data);
    // Recheck after hashing to reject concurrent duplicate ingestion.
    if (this.#records.has(id)) throw new Error('SOURCE_ALREADY_EXISTS');
    const revision = { id, version: 1, hash: digest, byteLength: data.length, metadata: copy(metadata), data };
    this.#records.set(id, { scope, deleted: false, revisions: [revision] });
    return this.#projection(revision);
  }
  async correct({ id, content, scope = 'public', expectedVersion, metadata = {} }) {
    const record = this.#read(id, scope, 'correct');
    if (record.deleted) throw new Error('DELETED');
    const oldVersion = record.revisions.at(-1).version;
    if (expectedVersion != null && expectedVersion !== oldVersion) throw new Error('STALE_REVISION');
    const data = toBytes(content), digest = await sha256(data);
    if (record.deleted || record.revisions.at(-1).version !== oldVersion) throw new Error('STALE_REVISION');
    const revision = { id, version: oldVersion + 1, hash: digest, byteLength: data.length, metadata: copy(metadata), data };
    record.revisions.push(revision);
    return this.#projection(revision);
  }
  #projection({ data, ...revision }) { return copy(revision); }
  delete({ id, scope = 'public' }) {
    const record = this.#read(id, scope, 'delete');
    record.deleted = true;
    record.revisions = record.revisions.map(({ id, version, hash, byteLength }) => ({ id, version, hash, byteLength }));
    return { id, deleted: true, purgedVersions: record.revisions.length };
  }
  list({ scope = 'public', includeHistory = false } = {}) {
    if (!this.#authorize(scope, 'list', null)) throw new Error('UNAUTHORIZED_SCOPE');
    return [...this.#records.values()].filter(r => r.scope === scope && !r.deleted)
      .flatMap(r => (includeHistory ? r.revisions : [r.revisions.at(-1)]).map(x => this.#projection(x)))
      .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : a.version - b.version);
  }
  materialize({ id, version, startByte = 0, endByte, scope = 'public' }) {
    const record = this.#read(id, scope, 'materialize');
    if (record.deleted) throw new Error('DELETED');
    const revision = version == null ? record.revisions.at(-1) : record.revisions.find(r => r.version === version);
    if (!revision) throw new Error('NOT_FOUND');
    const end = endByte ?? revision.data.length;
    integer(startByte, 'startByte'); integer(end, 'endByte');
    if (startByte > end || end > revision.data.length) throw new RangeError('INVALID_BYTE_RANGE');
    // Empty slices must still begin at a UTF-8 code point boundary.
    const boundary = offset => offset === 0 || offset === revision.data.length || (revision.data[offset] & 0xc0) !== 0x80;
    if (!boundary(startByte) || !boundary(end)) throw new Error('INVALID_UTF8_SLICE');
    const data = revision.data.slice(startByte, end);
    const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data);
    return { ...this.#projection(revision), startByte, endByte: end, text, bytes: data };
  }
  export({ scope = 'public' } = {}) {
    return this.list({ scope, includeHistory: true }).map(r => this.materialize({ id: r.id, version: r.version, scope }));
  }
}

export function createSyntheticHistory({ size = 64 } = {}) {
  integer(size, 'size', 1, 2048);
  const history = [{ id: 'pin-policy', sourceId: 'synthetic-policy', version: 1, text: 'Only public synthetic facts; preserve exact spans and unresolved contradictions.', pinned: true, required: false, exactSpan: null }];
  for (let i = 1; i <= size; i++) {
    const exactSpan = `SYNTHETIC_VALUE_${String((i * 7919 + 104729) % 1000003).padStart(6, '0')}`;
    history.push({ id: `fact-${String(i).padStart(4, '0')}`, sourceId: `synthetic-source-${i}`, version: 1, text: `Public fixture milestone ${i} exact marker ${exactSpan}.`, exactSpan, required: i <= Math.min(8, Math.ceil(size / 8)), pinned: false });
    history.push({ id: `noise-${String(i).padStart(4, '0')}`, sourceId: `synthetic-noise-${i}`, version: 1, text: `Synthetic background ${i}: architecture maintenance observations and unrelated notes.`, exactSpan: null, required: false, pinned: false });
  }
  return history.map((r, index) => ({ ...r, scope: 'public', timestamp: index, metadata: { synthetic: true, publicSafe: true } }));
}
const words = text => String(text).toLowerCase().match(/[\p{L}\p{N}_]+/gu) ?? [];
export function rankLexical(query, records) {
  const terms = new Set(words(query));
  return records.map(record => ({ record, score: words(`${record.id} ${record.text}`).filter(t => terms.has(t)).length }))
    .sort((a, b) => b.score - a.score || (a.record.id < b.record.id ? -1 : a.record.id > b.record.id ? 1 : 0)).map(x => copy(x.record));
}
async function packet(kind, items, snapshotDigest, extra = {}) {
  const object = { header: { format: 'dossier-packet/1', kind, snapshotDigest, ...extra }, items: copy(items) };
  const text = stableJSON(object);
  return { object, text, bytes: encoder.encode(text).length };
}
async function bounded(kind, atomic, ranked, budget, digest, extra = {}) {
  let packed = await packet(kind, atomic, digest, extra);
  if (packed.bytes > budget) return { status: 'PINNED_OVERFLOW', noDispatch: true, items: [], bytes: 0, requiredBytes: packed.bytes, packet: null };
  const chosen = copy(atomic);
  for (const item of ranked) {
    if (chosen.some(x => x.id === item.id)) continue;
    const next = await packet(kind, [...chosen, item], digest, extra);
    if (next.bytes <= budget) { chosen.push(item); packed = next; }
  }
  return { status: 'READY', noDispatch: false, items: chosen, bytes: packed.bytes, packet: packed.object };
}
function arm(id, selection, required) {
  const facts = required.map(f => ({ factId: f.id, sourceId: f.sourceId, recalled: Boolean(selection.items?.some(r => r.id === f.id && r.sourceId === f.sourceId && r.version === f.version && r.text.includes(f.exactSpan))) }));
  return { id, name: id, label: id, status: selection.status ?? 'READY', noDispatch: selection.noDispatch ?? false,
    bytes: selection.bytes, measuredBytes: selection.bytes, requiredBytes: selection.requiredBytes ?? null, packet: selection.packet, recall: facts,
    exactFactRecall: facts.length ? facts.filter(f => f.recalled).length / facts.length : null,
    inputTokens: null, cost: null, modelLatencyMs: null, taskQuality: null,
    unavailableReason: 'No model called; exact synthetic source coverage is not model task quality.' };
}
export async function runComparison(config = {}) {
  const history = config.history ?? createSyntheticHistory({ size: config.historySize ?? 64 });
  if (!Array.isArray(history) || new Set(history.map(r => r.id)).size !== history.length) throw new Error('INVALID_HISTORY');
  const budgetBytes = integer(config.budgetBytes ?? 12000, 'budgetBytes', 1, 1000000);
  const recentCount = integer(config.recentCount ?? 12, 'recentCount', 0, 10000);
  const retrievalLimit = integer(config.retrievalLimit ?? 12, 'retrievalLimit', 0, 10000);
  const workers = integer(config.workers ?? 4, 'workers', 1, 16);
  const permission = config.permission ?? (r => r.scope === 'public');
  const permitted = history.filter(r => permission(r) === true && !r.deleted);
  const pinnedIds = config.pinnedIds ?? history.filter(r => r.pinned).map(r => r.id);
  const requiredFactIds = config.requiredFactIds ?? history.filter(r => r.required).map(r => r.id);
  const lookup = new Map(permitted.map(r => [r.id, r]));
  for (const id of [...pinnedIds, ...requiredFactIds]) if (!lookup.has(id)) throw new Error('MISSING_OR_UNAUTHORIZED_EXACT_SOURCE');
  const pins = [...new Set(pinnedIds)].map(id => lookup.get(id)), required = [...new Set(requiredFactIds)].map(id => lookup.get(id));
  const digest = await sha256(stableJSON(permitted)), ranked = rankLexical(config.query ?? 'exact marker architecture', permitted);
  const selected = async (id, items) => { const p = await packet(id, items, digest); return arm(id, { items, packet: p.object, bytes: p.bytes }, required); };
  const arms = {};
  arms.full = await selected('full', permitted);
  arms.recent = await selected('recent', recentCount === 0 ? [] : permitted.slice(-recentCount));
  arms.retrieval = await selected('retrieval', ranked.slice(0, retrievalLimit));
  const atomic = [...new Map([...pins, ...required].map(r => [r.id, r])).values()];
  arms.sparse = arm('sparse', await bounded('sparse', atomic, ranked.slice(0, retrievalLimit), budgetBytes, digest, { bridge: 'Navigation only, never exact evidence.' }), required);
  const assignments = Array.from({ length: workers }, () => []);
  required.forEach((r, i) => assignments[i % workers].push(r));
  const workerPackets = [];
  for (let i = 0; i < workers; i++) workerPackets.push(await bounded('combined-worker', [...new Map([...pins, ...assignments[i]].map(r => [r.id, r])).values()], [], budgetBytes, digest, { worker: i, sharedPinsCounted: true }));
  const route = { format: 'dossier-route/1', workers, assignments: assignments.map(a => a.map(r => r.id)), sharedPinnedIds: pins.map(r => r.id), snapshotDigest: digest };
  const routingOverheadBytes = encoder.encode(stableJSON(route)).length;
  const failed = workerPackets.some(p => p.noDispatch);
  const allItems = failed ? [] : [...new Map(workerPackets.flatMap(p => p.items).map(r => [r.id, r])).values()];
  arms.combined = arm('combined', { status: failed ? 'PINNED_OVERFLOW' : 'READY', noDispatch: failed, items: allItems,
    bytes: routingOverheadBytes + workerPackets.reduce((s, p) => s + p.bytes, 0),
    packet: { route, workerPackets: workerPackets.map(p => ({ status: p.status, bytes: p.bytes, packet: p.packet })), accounting: { routingOverheadBytes, workerSerializedBytes: workerPackets.reduce((s, p) => s + p.bytes, 0) } } }, required);
  return { schemaVersion: 1, mode: 'fixture', binding: 'local deterministic JavaScript; no model', provenance: { synthetic: true, publicSafe: true, providerCalls: 0, byteMethod: 'UTF-8 stable JSON transport including headers and shared copies; not RFC8785' },
    config: { historySize: config.historySize ?? 64, sourceRecords: history.length, budgetBytes, recentCount, retrievalLimit, workers, query: config.query ?? 'exact marker architecture' }, datasetDigest: digest, arms };
}
