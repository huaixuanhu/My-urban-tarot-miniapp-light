/** One authorised real acquisition, local PostgreSQL and local identity only.
 * Never imported by deployed application code. No OpenAI or cloud DB access.
 */
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { createServer as createVite } from 'vite';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig } from '../access/config.ts';
import { createAccessGuard } from '../access/guard.ts';
import { createRecordsHandler } from '../server/records/service.mjs';
import { createRecordStoreFromSql } from '../server/records/neon-store.mjs';
import { createRandomHandler } from '../server/random/service.mjs';
import { createRandomStoreFromSql } from '../server/random/neon-store.mjs';
import { openLocalPostgres } from './lib/local-postgres.mjs';
import { createOneShotANUProvider } from './lib/anu-live-provider.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const port = Number(process.argv[2] || 5176);
if (!Number.isInteger(port) || port < 1024 || port > 64535) throw new Error('LOCAL_PORT_INVALID');
const localOrigin = `http://127.0.0.1:${port}`, appOrigin = `https://${accessConfig.hostname}`;
const evidenceDirectory = path.join(root, '.local/anu-live');
await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
const provider = await createOneShotANUProvider({ keyFile: path.join(root, '.local/anu-live.env'), evidenceDirectory });
const db = await openLocalPostgres({ directory: path.join(root, '.local/anu-live-pg'), migrations: [
  new URL('../server/records/001-create-records.sql', import.meta.url),
  new URL('../server/random/003-create-random-pool.sql', import.meta.url),
] });
let vite, server;
const keys = await generateKeyPair('RS256'), kid = randomUUID();
const publicKey = await exportJWK(keys.publicKey);
const accessGuard = createAccessGuard(createLocalJWKSet({ keys: [{ ...publicKey, kid, alg: 'RS256' }] }));
async function localToken() {
  return new SignJWT({ email: 'local-anu-validation@example.test', type: 'app' })
    .setProtectedHeader({ alg: 'RS256', kid }).setIssuer(accessConfig.issuer).setAudience(accessConfig.audience)
    .setSubject('local-anu-validation').setIssuedAt().setExpirationTime('2m').sign(keys.privateKey);
}
const randomStore = createRandomStoreFromSql(db.sql), recordStore = createRecordStoreFromSql(db.sql);
// Paid interpretation is not part of this authorised local verification.
recordStore.getAIInterpretations = async () => [];
const random = createRandomHandler({ accessGuard, getStore: async () => randomStore, getProvider: async () => provider });
const record = createRecordsHandler({ accessGuard, getStore: async () => recordStore });
async function budgetUsed() {
  try { await readFile(path.join(evidenceDirectory, 'attempt.json')); return true; }
  catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}
function respond(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(value));
}
async function stop() {
  server?.close(); await vite?.close(); await db.close();
}
try {
  const cacheDir = path.join(os.tmpdir(), 'augurwell-anu-live-vite');
  vite = await createVite({ envDir: path.join(evidenceDirectory, 'no-env'), cacheDir,
    server: { middlewareMode: true, hmr: false,
      fs: { allow: [root, cacheDir], deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/.local/**'] },
      watch: { ignored: ['**/.local/**'] },
    }, plugins: [{ name: 'explicit-local-anu-live', transformIndexHtml(html) {
      return html.replace('<body>', '<body><aside role="note" style="position:fixed;top:0;left:0;right:0;z-index:9999;text-align:center;background:#e1f0e5;color:#203c2a;font:12px/24px system-ui;pointer-events:none">本地验证 · ANU 真实接口，限采集 1 次 · 本机数据库与测试身份 · AI 未启用，不写云端</aside>');
    } }] });
  server = http.createServer(async (req, res) => {
    try {
      if (req.headers.host !== `127.0.0.1:${port}`) { respond(res, 403, { error: { code: 'LOCAL_HOST_REQUIRED' } }); return; }
      const url = new URL(req.url, localOrigin);
      if (!url.pathname.startsWith('/api/')) { vite.middlewares(req, res); return; }
      if (req.method !== 'GET' && req.headers.origin !== localOrigin) { respond(res, 403, { error: { code: 'LOCAL_ORIGIN_REQUIRED' } }); return; }
      let body = Buffer.alloc(0);
      for await (const chunk of req) { body = Buffer.concat([body, chunk]); if (body.length > 65536) { respond(res, 413, {}); return; } }
      if (url.pathname === '/api/_local-status' && req.method === 'GET') {
        respond(res, 200, { local: true, provider: 'ANU', maximumRequests: 1, requestBudgetUsed: await budgetUsed(),
          storage: 'local-postgresql', aiEnabled: false }); return;
      }
      if (url.pathname === '/api/random' && req.method === 'POST' && await budgetUsed()) {
        let input; try { input = JSON.parse(body.toString()); } catch {}
        // Existing IDs still use the production idempotency/recovery path.
        if (input?.action === 'collect' && typeof input.id === 'string' && /^[0-9a-f-]{36}$/i.test(input.id)
            && !await randomStore.get(input.id)) {
          respond(res, 400, { error: { code: 'INVALID_RANDOM_REQUEST', message: '本次本地验证仅采集一次，请使用已有库存。' } }); return;
        }
      }
      if (url.pathname === '/api/interpretations') {
        respond(res, 503, { error: { code: 'AI_NOT_CONFIGURED', message: '本次仅验证真实量子随机，AI 未启用。' } }); return;
      }
      const handler = url.pathname === '/api/random' ? random : url.pathname === '/api/records' ? record : null;
      if (!handler) { respond(res, 404, {}); return; }
      const headers = new Headers({ 'cf-access-jwt-assertion': await localToken() });
      if (req.method !== 'GET') { headers.set('origin', appOrigin); headers.set('content-type', req.headers['content-type'] || ''); }
      const response = await handler(new Request(`${appOrigin}${url.pathname}${url.search}`, { method: req.method, headers,
        ...(req.method !== 'GET' ? { body } : {}),
      }));
      res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
    } catch { respond(res, 500, { error: { code: 'LOCAL_VALIDATION_ERROR', message: '本地验证出现错误；请保留原操作编号查询，勿重复采集。' } }); }
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  console.log(`LOCAL ANU VALIDATION ${localOrigin} — one request maximum, local DB only, no AI.`);
  let stopping = false;
  const shutdown = async () => { if (stopping) return; stopping = true; await stop(); process.exit(0); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
} catch { await stop(); console.error('LOCAL_ANU_START_FAILED'); process.exitCode = 1; }
