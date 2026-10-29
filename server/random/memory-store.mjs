import { COLLECTION_LEASE_MS } from './service.mjs';
/** Synthetic local fixture only. No persistent/cloud guarantee. */
export function createMemoryRandomStore() {
  const operations = new Map();
  let pool = { version: 0, batchId: null, fetchedAt: null, values: [], cursor: 0, collectId: null, collectStarted: null, lastCollectStarted: null };
  const copy = value => structuredClone(value);
  return {
    async getPool() { return copy(pool); },
    async get(id) { return copy(operations.get(id) ?? null); },
    async claim(operation) {
      if (operations.has(operation.id)) return { operation: copy(operations.get(operation.id)), inserted: false };
      operations.set(operation.id, copy(operation)); return { operation: copy(operation), inserted: true };
    },
    async startCollection(id, startedAt) {
      if (operations.get(id)?.status !== 'pending') return false;
      const time = Date.parse(startedAt);
      if (pool.collectId && time - Date.parse(pool.collectStarted) < COLLECTION_LEASE_MS) return false;
      if (pool.lastCollectStarted && time - Date.parse(pool.lastCollectStarted) < 1000) return false;
      pool.collectId = id; pool.collectStarted = startedAt; pool.lastCollectStarted = startedAt; return true;
    },
    async completeCollection(id, values, fetchedAt) {
      const operation = operations.get(id);
      if (pool.collectId !== id || operation?.status !== 'pending') return null;
      pool = { ...pool, version: pool.version + 1, batchId: id, fetchedAt, values: copy(values), cursor: 0, collectId: null, collectStarted: null };
      const completed = { ...operation, status: 'completed', completedAt: fetchedAt, batchId: id, fetchedAt };
      operations.set(id, completed); return copy(completed);
    },
    async fail(id, status, message, completedAt) {
      const operation = operations.get(id);
      if (!operation) throw new Error('operation missing');
      if (operation.status === 'pending') operations.set(id, { ...operation, status, message, completedAt });
      if (pool.collectId === id) { pool.collectId = null; pool.collectStarted = null; }
      return copy(operations.get(id));
    },
    async commitDraw(id, expectedVersion, consumed, deck, completedAt) {
      const operation = operations.get(id);
      if (operation?.status !== 'pending' || pool.version !== expectedVersion || pool.cursor + consumed > pool.values.length) return null;
      pool.cursor += consumed; pool.version++;
      const completed = { ...operation, status: 'completed', completedAt, deck: copy(deck) };
      operations.set(id, completed); return copy(completed);
    },
  };
}
