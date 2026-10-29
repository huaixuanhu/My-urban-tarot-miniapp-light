export class RecordStorageUnavailable extends Error {}
export class RecordStorageNotConfigured extends Error {}
export class RecordConflict extends Error {}
export interface RecordStore {
  create(record: any, hash: string): Promise<{ record: any; hash: string; inserted: boolean }>;
  get(id: string): Promise<any | null>;
  list(options: { limit: number; cursor: { savedAt: string; id: string } | null }): Promise<any[]>;
  getRandomDraw?(id: string): Promise<any | null>;
  getAIInterpretations?(ids: string[]): Promise<any[]>;
}
export function createRecordsHandler(options: {
  accessGuard: (request: Request) => Promise<Response>;
  getStore: () => Promise<RecordStore>;
  now?: () => Date;
  onError?: (code: string) => void;
}): (request: Request) => Promise<Response>;
