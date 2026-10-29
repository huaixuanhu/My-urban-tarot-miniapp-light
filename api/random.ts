import { createRemoteJWKSet } from 'jose';
import { accessConfig } from '../access/config.js';
import { createAccessGuard } from '../access/guard.js';
import { createRandomHandler, RandomStorageNotConfigured, type RandomStore } from '../server/random/service.mjs';
import { createNeonRandomStore } from '../server/random/neon-store.mjs';
import { createANUProvider } from '../server/random/provider.mjs';
const keys = createRemoteJWKSet(new URL(`${accessConfig.issuer}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 3600000,
});
let store: Promise<RandomStore> | undefined;
const handler = createRandomHandler({
  accessGuard: createAccessGuard(keys),
  getStore: async () => {
    const connection = process.env.AUGURWELL_RECORDS_DATABASE_URL;
    if (!connection?.trim()) throw new RandomStorageNotConfigured();
    store ??= createNeonRandomStore(connection).catch(error => { store = undefined; throw error; });
    return store;
  },
  getProvider: async () => createANUProvider(process.env.ANU_API_KEY),
  onError: code => console.error('[augurwell-random]', code),
});
export const maxDuration = 30;
export default { fetch: handler };
