import { createRemoteJWKSet } from 'jose';
import { accessConfig } from '../access/config.js';
import { createAccessGuard } from '../access/guard.js';
import { createRecordsHandler, RecordStorageNotConfigured, type RecordStore } from '../server/records/service.mjs';
import { createNeonRecordStore } from '../server/records/neon-store.mjs';

const keys = createRemoteJWKSet(new URL(`${accessConfig.issuer}/cdn-cgi/access/certs`), {
  timeoutDuration: 5000, cooldownDuration: 30000, cacheMaxAge: 3600000,
});
let store: Promise<RecordStore> | undefined;
const handler = createRecordsHandler({
  accessGuard: createAccessGuard(keys),
  getStore: async () => {
    const connection = process.env.AUGURWELL_RECORDS_DATABASE_URL;
    if (!connection?.trim()) throw new RecordStorageNotConfigured();
    // Cache the driver only. The durable database owns every record.
    store ??= createNeonRecordStore(connection).catch(error => { store = undefined; throw error; });
    return store;
  },
  onError: code => console.error('[augurwell-records]', code),
});

export default { fetch: handler };
