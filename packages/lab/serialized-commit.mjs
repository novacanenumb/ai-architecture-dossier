const installed = new WeakSet();
/** Per-instance ordering only. No rollback, durable transaction, or cross-process exclusion. */
export function serializeCommits(simulator) {
  if (!simulator || typeof simulator.commit !== 'function') throw new TypeError('Simulator commit function required');
  if (installed.has(simulator)) return simulator;
  const original = simulator.commit.bind(simulator); let queue = Promise.resolve();
  simulator.commit = (...args) => {
    const attempt = queue.then(() => original(...args));
    queue = attempt.then(() => undefined, () => undefined);
    return attempt;
  };
  installed.add(simulator); return simulator;
}
