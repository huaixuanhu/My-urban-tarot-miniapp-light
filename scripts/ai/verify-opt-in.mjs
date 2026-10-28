/** Derived from governance/STATE.md stage2.5.4.3. Manual, bounded synthetic validation.
 * Default: offline plan. --run <fresh ignored directory> performs at most six
 * generations, reserves <= US$1, never retries and never connects to Neon.
 * OPENAI_API_KEY must be provided in process memory, never a CLI argument.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig } from '../../access/config.ts';
import { createAccessGuard } from '../../access/guard.ts';
import { createInterpretationsHandler } from '../../server/ai/service.mjs';
import { createOpenAIProvider } from '../../server/ai/provider.mjs';

const plan = ['gpt-6.1-terra', 'gpt-6.1-sol'].flatMap(model => [
  { effort: 'low', maxOutputTokens: 3000, reserve: model.endsWith('terra') ? 0.05 : 0.09 },
  { effort: 'medium', maxOutputTokens: 6000, reserve: model.endsWith('terra') ? 0.07 : 0.13 },
  { effort: 'high', maxOutputTokens: 12000, reserve: model.endsWith('terra') ? 0.10 : 0.19 },
].map(item => ({ model, ...item })));
const [flag, destination] = process.argv.slice(2);
if (flag !== '--run') {
  console.log(JSON.stringify({ syntheticOnly: true, generationLimit: 6, budgetUSD: 1, reservedTotalUSD: 0.63, plan }, null, 2));
  process.exit(0);
}
const root = process.cwd(), directory = path.resolve(destination || '');
if (!directory.startsWith(path.join(root, '.local') + path.sep) || !process.env.OPENAI_API_KEY) throw new Error('Fresh ignored result directory and in-memory credential required.');
await mkdir(directory, { recursive: false, mode: 0o700 });
const save = (name, value) => writeFile(path.join(directory, name), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 });
const ledger = { budgetUSD: 1, generationLimit: 6, reservedUSD: 0, generations: 0, results: [] };
await save('ledger.json', ledger);
const entries = new Map();
const store = {
  async get(id) { return structuredClone(entries.get(id) ?? null); },
  async claim(attempt, hash) {
    if (entries.has(attempt.id)) return { attempt: structuredClone(entries.get(attempt.id)), hash: entries.get(attempt.id).requestHash, inserted: false };
    entries.set(attempt.id, structuredClone(attempt)); return { attempt, hash, inserted: true };
  },
  async finish(id, result) { entries.set(id, structuredClone(result)); return result; },
};
const keys = await generateKeyPair('RS256');
const guard = createAccessGuard(createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'bounded-live', alg: 'RS256' }] }));
const token = await new SignJWT({ type: 'app', email: 'synthetic-local@example.test' }).setProtectedHeader({ alg: 'RS256', kid: 'bounded-live' })
  .setIssuer(accessConfig.issuer).setAudience(accessConfig.audience).setSubject('synthetic-local-validation')
  .setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
const origin = `https://${accessConfig.hostname}`;
let current, responseIndex = 0;
const provider = createOpenAIProvider(process.env.OPENAI_API_KEY, { fetcher: async (url, init) => {
  const generation = url === 'https://api.openai.com/v1/responses';
  if (generation) {
    if (ledger.generations >= 6 || ledger.reservedUSD + current.reserve > 1) throw new Error('Budget exhausted.');
    ledger.generations++; ledger.reservedUSD = Math.round((ledger.reservedUSD + current.reserve) * 100) / 100;
    await save('ledger.json', ledger); // unknown calls retain their full reservation
  }
  const response = await fetch(url, init);
  if (generation) {
    const raw = await response.clone().json().catch(() => null);
    await save(`${String(++responseIndex).padStart(2, '0')}-provider.json`, { httpStatus: response.status, response: raw });
  }
  return response;
} });
const service = createInterpretationsHandler({ accessGuard: guard, getStore: async () => store, getProvider: async () => provider });
for (current of plan) {
  const started = Date.now();
  const reading = {
    schemaVersion: 1, id: randomUUID(), startedAt: new Date().toISOString(),
    question: '我有一个业余创作计划，想把自己画的城市观察整理成小册子，但总在准备和开工之间犹豫。怎样理解这个阶段的动力和阻力？',
    interpretation: '', reflection: '', spread: { type: 'free', name: '自由摆牌' },
    cards: [0, 1, 2].map((n) => ({ physicalId: n, sourceCardId: `major-0${n}`, faceUp: true,
      reversed: n === 1, x: n * 2 - 2, z: -0.5, drawOrder: n + 1, zIndex: n + 1,
      positionLabel: ['当下的动力', '需要留意的阻力', '可探索的角度'][n] })),
  };
  const input = { id: randomUUID(), reading, model: current.model, effort: current.effort, maxOutputTokens: current.maxOutputTokens };
  const response = await service(new Request(`${origin}/api/interpretations`, { method: 'POST',
    headers: { 'cf-access-jwt-assertion': token, origin, 'content-type': 'application/json' }, body: JSON.stringify(input) }));
  const result = await response.json();
  await save(`${current.model}-${current.effort}.json`, { input, httpStatus: response.status, result });
  const item = { model: current.model, effort: current.effort, maxOutputTokens: current.maxOutputTokens,
    httpStatus: response.status, status: result.interpretation?.status ?? result.error?.code,
    elapsedSeconds: Math.round((Date.now() - started) / 100) / 10, usage: result.interpretation?.usage ?? null };
  ledger.results.push(item); await save('ledger.json', ledger);
  console.log(JSON.stringify(item));
  // Replay/lookup exercise the real handler but MUST NOT cause another call.
  const before = ledger.generations;
  await service(new Request(`${origin}/api/interpretations?id=${input.id}`, { headers: { 'cf-access-jwt-assertion': token } }));
  await service(new Request(`${origin}/api/interpretations`, { method: 'POST', headers: { 'cf-access-jwt-assertion': token, origin, 'content-type': 'application/json' }, body: JSON.stringify(input) }));
  if (ledger.generations !== before) throw new Error('Replay produced an unexpected generation.');
  if (item.status !== 'completed') break; // inspect a failure before any further spending
}
console.log(JSON.stringify({ completed: ledger.results.length, generations: ledger.generations, reservedUSD: ledger.reservedUSD }));
