export class AIStorageNotConfigured extends Error {}
export class AIStorageUnavailable extends Error {}
export interface AIStore {
  get(id: string): Promise<any | null>;
  claim(attempt: any, hash: string): Promise<{ attempt: any; hash: string; inserted: boolean }>;
  finish(id: string, attempt: any): Promise<any>;
}
export interface AIProvider {
  count(payload: any): Promise<number>;
  generate(payload: any): Promise<any>;
}
export function publicInterpretation(attempt: any, now?: Date): any;
export function createInterpretationsHandler(options: {
  accessGuard: (request: Request) => Promise<Response>;
  getStore: () => Promise<AIStore>;
  getProvider: () => Promise<AIProvider>;
  now?: () => Date;
  onError?: (code: string) => void;
}): (request: Request) => Promise<Response>;
