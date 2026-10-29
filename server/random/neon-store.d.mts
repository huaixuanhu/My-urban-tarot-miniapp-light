import type { RandomStore } from './service.mjs';
export function createNeonRandomStore(connectionString: string): Promise<RandomStore>;
export function createRandomStoreFromSql(sql: any): RandomStore;
