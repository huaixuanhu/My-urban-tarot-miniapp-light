import type { AIProvider } from './service.mjs';
export class AIProviderError extends Error { kind: string; constructor(kind: string); }
export function createOpenAIProvider(apiKey: string | undefined, options?: { fetcher?: typeof fetch; timeoutMs?: number }): AIProvider;
