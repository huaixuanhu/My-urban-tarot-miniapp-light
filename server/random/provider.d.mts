import type { RandomProvider } from './service.mjs';
export class RandomProviderError extends Error { kind: string; constructor(kind: string); }
export function createANUProvider(key: string | undefined, fetcher?: typeof fetch): RandomProvider;
export function validBatch(values: unknown): boolean;
