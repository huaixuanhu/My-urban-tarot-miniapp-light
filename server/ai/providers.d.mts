import type { AIProvider } from './service.mjs';
export function createModelProvider(
  model: string,
  env?: { OPENAI_API_KEY?: string; ANTHROPIC_API_KEY?: string },
  options?: { fetcher?: typeof fetch; timeoutMs?: number },
): AIProvider;
