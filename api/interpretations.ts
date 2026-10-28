import { createRemoteJWKSet } from 'jose';
import { accessConfig } from '../access/config.js';
import { createAccessGuard } from '../access/guard.js';
import { createInterpretationsHandler, AIStorageNotConfigured, type AIStore } from '../server/ai/service.mjs';
import { createNeonAIStore } from '../server/ai/neon-store.mjs';
import { createOpenAIProvider } from '../server/ai/provider.mjs';

const keys = createRemoteJWKSet(new URL(`${accessConfig.issuer}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 3600000,
});
let store: Promise<AIStore> | undefined;
const handler = createInterpretationsHandler({
  accessGuard: createAccessGuard(keys),
  getStore: async () => {
    const connection = process.env.AUGURWELL_RECORDS_DATABASE_URL;
    if (!connection?.trim()) throw new AIStorageNotConfigured();
    store ??= createNeonAIStore(connection).catch(error => { store = undefined; throw error; });
    return store;
  },
  getProvider: async () => createOpenAIProvider(process.env.OPENAI_API_KEY),
  onError: code => console.error('[augurwell-ai]', code),
});

export const maxDuration = 180;
export default { fetch: handler };
