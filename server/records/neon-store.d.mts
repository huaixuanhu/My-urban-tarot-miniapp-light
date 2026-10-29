import type { RecordStore } from './service.mjs';
export function createNeonRecordStore(connectionString: string | undefined): Promise<RecordStore>;

export function createRecordStoreFromSql(sql: unknown): RecordStore;
