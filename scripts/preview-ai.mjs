/** Local UI/HTTP fixture only. Never imported by the app or deployed API.
 * pnpm exec tsx scripts/preview-ai.mjs [port] [--visitor] [--records-demo]
 * Uses synthetic signing keys and in-memory records, NEVER cloud, OpenAI or ANU.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { createServer as createVite } from 'vite';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig } from '../access/config.ts';
import { createAccessGuard } from '../access/guard.ts';
import { createRecordsHandler } from '../server/records/service.mjs';
import { createRandomHandler } from '../server/random/service.mjs';
import { createMemoryRandomStore } from '../server/random/memory-store.mjs';
import { RandomProviderError } from '../server/random/provider.mjs';
import { createInterpretationsHandler } from '../server/ai/service.mjs';
import { previewProviderOutput, previewRecords } from './ai/stage2513-fixtures.mjs';

const visitorPreview = process.argv.includes('--visitor');
const recordsDemo = process.argv.includes('--records-demo') && !visitorPreview;
const port = Number(process.argv.slice(2).find(argument => !argument.startsWith('--')) || 5174), localOrigin = `http://127.0.0.1:${port}`, appOrigin = `https://${accessConfig.hostname}`;
const attempts = new Map(), records = new Map();
let scenario = 'completed', calls = 0, searchCalls = 0, seededRecords = 0;
let randomScenario = 'completed', randomCalls = 0;
const randomStore = createMemoryRandomStore();
const clone = value => structuredClone(value);
function seedRecords() {
  if (visitorPreview) return;
  for (const record of previewRecords()) {
    if (records.has(record.id)) continue;
    records.set(record.id, { record, hash: `local-demo-${record.id}` }); seededRecords++;
  }
}
if (recordsDemo) seedRecords();
const aiStore = {
  async claim(attempt, hash) {
    if (attempts.has(attempt.id)) return { attempt: clone(attempts.get(attempt.id).attempt), hash: attempts.get(attempt.id).hash, inserted: false };
    attempts.set(attempt.id, { attempt: clone(attempt), hash }); return { attempt: clone(attempt), hash, inserted: true };
  },
  async get(id) { return clone(attempts.get(id)?.attempt ?? null); },
  async finish(id, attempt) {
    const row = attempts.get(id); if (!row) throw new Error('Missing fixture attempt.');
    if (row.attempt.status === 'pending') row.attempt = clone(attempt);
    return clone(row.attempt);
  },
};
const recordStore = {
  async create(record, hash) {
    if (records.has(record.id)) return { ...clone(records.get(record.id)), inserted: false };
    records.set(record.id, { record: clone(record), hash }); return { record: clone(record), hash, inserted: true };
  },
  async get(id) { return clone(records.get(id)?.record ?? null); },
  async list({ limit, cursor }) {
    return [...records.values()].map(row => clone(row.record))
      .sort((a, b) => b.savedAt.localeCompare(a.savedAt) || b.id.localeCompare(a.id))
      .filter(row => !cursor || row.savedAt < cursor.savedAt || (row.savedAt === cursor.savedAt && row.id < cursor.id)).slice(0, limit);
  },
  async getRandomDraw(id) { return randomStore.get(id); },
  async getAIInterpretations(ids) { return Promise.all(ids.map(id => aiStore.get(id))); },
};
const keys = await generateKeyPair('RS256'), kid = randomUUID();
const publicKey = await exportJWK(keys.publicKey);
const accessGuard = createAccessGuard(createLocalJWKSet({ keys: [{ ...publicKey, kid, alg: 'RS256' }] }));
async function syntheticToken() {
  return new SignJWT({ email: 'local-fixture@example.test', type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid }).setIssuer(accessConfig.issuer).setAudience(accessConfig.audience)
    .setSubject('local-ui-fixture').setIssuedAt().setExpirationTime('2m').sign(keys.privateKey);
}
const provider = {
  async count() { return 1100; },
  async generate(payload) {
    calls += 1; const mode = scenario;
    await new Promise(resolve => setTimeout(resolve, mode === 'slow' ? 10000 : 1400));
    if (mode === 'unknown') throw new Error('Synthetic transport failure.');
    const reading = typeof payload.input === 'string' ? JSON.parse(payload.input) : null;
    if (!reading?.cards) throw new Error('Fixture requires canonical input.');
    const live = payload.tools?.some(tool => tool.type === 'web_search') === true;
    const usage = { input_tokens: 1100, output_tokens: 400, total_tokens: 1500, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 50 } };
    if (mode === 'incomplete') return { status: 'incomplete', model: payload.model, usage, incomplete_details: { reason: 'max_output_tokens' }, output: [] };
    if (mode === 'refusal') return { status: 'completed', model: payload.model, usage, output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Synthetic refusal.' }] }] };
    if (live && mode !== 'web-missing') searchCalls++;
    return { id: 'local-fixture-response', status: 'completed', model: payload.model, usage,
      output: previewProviderOutput(reading, { live, mode, variant: payload.instructions.includes('解读详细度：细读') ? 'deep' : 'standard' }) };
  },
};
const interpret = createInterpretationsHandler({ accessGuard, getStore: async () => aiStore, getProvider: async () => provider });
const random = createRandomHandler({ accessGuard, getStore: async () => randomStore, getProvider: async () => ({
  async collect() {
    randomCalls++;
    const mode = randomScenario;
    await new Promise(resolve => setTimeout(resolve, mode === 'slow' ? 10000 : 350));
    if (mode === 'failed') throw new RandomProviderError('rejected');
    if (mode === 'unknown') throw new RandomProviderError('unknown');
    return Array.from({ length: 1024 }, (_, i) => (i * 193 + randomCalls * 59) % 65000);
  },
}) });
const record = createRecordsHandler({ accessGuard, getStore: async () => recordStore });
const vite = await createVite({ server: { middlewareMode: true, hmr: { port: port + 1000 } }, plugins: [{
  name: 'explicit-local-ai-fixture', transformIndexHtml(html) {
    const body = visitorPreview ? '<body data-visitor-preview="true">' : '<body>';
    const notice = visitorPreview ? '本地访客预览 · 模拟数据' : '本地预览 · 模拟数据';
    return html.replace('<body>', `${body}<aside role="note" style="position:fixed;top:0;left:0;right:0;z-index:9999;text-align:center;background:#fff3c9;color:#42351e;font:12px/24px system-ui;pointer-events:none">${notice}</aside>`);
  },
}] });
const server = http.createServer(async (req, res) => {
  try {
    if (req.headers.host !== `127.0.0.1:${port}`) { res.writeHead(403); res.end(); return; }
    const url = new URL(req.url, localOrigin);
    if (url.pathname.startsWith('/api/')) {
      if (req.method !== 'GET' && req.headers.origin !== localOrigin) { res.writeHead(403); res.end(); return; }
      let body = Buffer.alloc(0);
      for await (const chunk of req) { body = Buffer.concat([body, chunk]); if (body.length > 65536) { res.writeHead(413); res.end(); return; } }
      if (url.pathname === '/api/_preview') {
        if (req.method === 'POST') {
          const value = JSON.parse(body.toString());
          if (value.scenario !== undefined) {
            if (!['completed', 'incomplete', 'refusal', 'unknown', 'slow', 'web-missing', 'web-empty', 'web-failed'].includes(value.scenario)) throw new Error('Unknown fixture.');
            scenario = value.scenario;
          }
          if (value.randomScenario !== undefined) {
            if (!['completed', 'failed', 'unknown', 'slow'].includes(value.randomScenario)) throw new Error('Unknown random fixture.');
            randomScenario = value.randomScenario;
          }
          if (value.seedRecords === true) seedRecords();
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ fixture: true, visitorPreview, scenario, calls, searchCalls, externalCalls: 0, seededRecords, randomScenario, randomCalls, attempts: attempts.size, records: records.size })); return;
      }
      const handler = url.pathname === '/api/interpretations' ? interpret : url.pathname === '/api/records' ? record : url.pathname === '/api/random' ? random : null;
      if (!handler) { res.writeHead(404); res.end(); return; }
      // The local visitor fixture never synthesizes a signed-in identity.
      // This test seam is not a deployed authentication or public-access gate.
      if (visitorPreview) {
        res.writeHead(401, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ error: { code: 'ACCESS_REQUIRED', message: '此功能需要邮箱验证；本地访客预览尚未接入验证。' } })); return;
      }
      const headers = new Headers({ 'cf-access-jwt-assertion': await syntheticToken() });
      if (req.method !== 'GET') { headers.set('origin', appOrigin); headers.set('content-type', req.headers['content-type'] || ''); }
      const response = await handler(new Request(`${appOrigin}${url.pathname}${url.search}`, {
        method: req.method, headers, ...(req.method !== 'GET' ? { body } : {}),
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer())); return;
    }
    vite.middlewares(req, res);
  } catch { res.writeHead(500, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: { code: 'LOCAL_FIXTURE_ERROR', message: '本地模拟服务发生错误，没有发起外部调用。' } })); }
});
server.listen(port, '127.0.0.1', () => console.log(`LOCAL ${visitorPreview ? 'VISITOR' : 'SYNTHETIC'} PREVIEW ${localOrigin} — no ANU/OpenAI/Neon connections.`));
async function stop() { server.close(); await vite.close(); process.exit(0); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
