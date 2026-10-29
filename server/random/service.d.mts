export class RandomStorageNotConfigured extends Error {}
export const COLLECTION_LEASE_MS: number;
export interface RandomStore {
  getPool(): Promise<any>;
  get(id: string): Promise<any | null>;
  claim(operation: any): Promise<{ operation: any; inserted: boolean }>;
  startCollection(id: string, startedAt?: string): Promise<boolean>;
  completeCollection(id: string, values: number[], fetchedAt: string): Promise<any | null>;
  fail(id: string, status: string, message: string, completedAt: string): Promise<any>;
  commitDraw(id: string, version: string | number, consumed: number, deck: any, completedAt: string): Promise<any | null>;
}
export interface RandomProvider { collect(): Promise<number[]> }
export function createRandomHandler(options: {
  accessGuard: (request: Request) => Promise<Response>;
  getStore: () => Promise<RandomStore>;
  getProvider: () => Promise<RandomProvider>;
  now?: () => Date;
  onError?: (code: string) => void;
}): (request: Request) => Promise<Response>;
export function poolMetadata(pool: any, now?: Date): any;
export function publicOperation(operation: any, now?: Date): any;
