/** Local UI/HTTP fixture only. Never imported by the app or deployed API.
 * pnpm exec tsx scripts/preview-ai.mjs
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

const port = Number(process.argv[2] || 5174), localOrigin = `http://127.0.0.1:${port}`, appOrigin = `https://${accessConfig.hostname}`;
const attempts = new Map(), records = new Map();
let scenario = 'completed', calls = 0;
let randomScenario = 'completed', randomCalls = 0;
const randomStore = createMemoryRandomStore();
const clone = value => structuredClone(value);
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
    const usage = { input_tokens: 1100, output_tokens: 400, total_tokens: 1500, input_tokens_details: { cached_tokens: 0 }, output_tokens_details: { reasoning_tokens: 50 } };
    if (mode === 'incomplete') return { status: 'incomplete', model: payload.model, usage, incomplete_details: { reason: 'max_output_tokens' }, output: [] };
    if (mode === 'refusal') return { status: 'completed', model: payload.model, usage, output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Synthetic refusal.' }] }] };
    const answer = {
      summary: '本地模拟解读：这段文字只用于检查界面与保存流程，没有调用 AI，也没有产生费用。牌之间的关系可以作为观察问题的线索；你的判断仍然属于你。',
      cards: reading.cards.map(card => ({ sourceCardId: card.sourceCardId, reversed: card.reversed, positionLabel: card.positionLabel,
        basis: card.reversed ? 'generated_reversal_extension' : 'provided_meaning',
        interpretation: `模拟内容 · ${card.name}：从已有牌义中寻找与自己问题有关的观察角度。${card.reversed ? '此处逆位仅为延伸解释。' : ''}`,
      })),
      reflectionQuestions: ['这里哪一个角度与你自己的感受最接近？'],
      limitations: ['这是本地合成测试内容。原始资料没有独立逆位牌义。'],
    };
    return { id: 'local-fixture-response', status: 'completed', model: payload.model, usage,
      output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(answer) }] }] };
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
    return html.replace('<body>', '<body><aside role="note" style="position:fixed;top:0;left:0;right:0;z-index:9999;text-align:center;background:#fff3c9;color:#42351e;font:12px/24px system-ui;pointer-events:none">本地验证 · 合成随机数据、模拟 AI 与记录 · 未调用 ANU，无费用，不写入云端</aside>');
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
            if (!['completed', 'incomplete', 'refusal', 'unknown', 'slow'].includes(value.scenario)) throw new Error('Unknown fixture.');
            scenario = value.scenario;
          }
          if (value.randomScenario !== undefined) {
            if (!['completed', 'failed', 'unknown', 'slow'].includes(value.randomScenario)) throw new Error('Unknown random fixture.');
            randomScenario = value.randomScenario;
          }
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        res.end(JSON.stringify({ fixture: true, scenario, calls, randomScenario, randomCalls, attempts: attempts.size, records: records.size })); return;
      }
      const handler = url.pathname === '/api/interpretations' ? interpret : url.pathname === '/api/records' ? record : url.pathname === '/api/random' ? random : null;
      if (!handler) { res.writeHead(404); res.end(); return; }
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
server.listen(port, '127.0.0.1', () => console.log(`LOCAL SYNTHETIC PREVIEW ${localOrigin} — no ANU/OpenAI/Neon connections.`));
async function stop() { server.close(); await vite.close(); process.exit(0); }
process.once('SIGINT', stop); process.once('SIGTERM', stop);
