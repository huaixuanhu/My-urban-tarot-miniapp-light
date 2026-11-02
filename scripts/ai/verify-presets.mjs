/** Derived from governance/STATE.md stage2.5.11 and docs/ai/stage2.5.7/README.md.
 * Manual evaluation only. Default prints an offline plan; --run <fresh .local
 * directory> makes at most 12 generations, reserves <= US$1, and never retries.
 * stage2.5.11.1 follow-up: --case creation-deep selects only its two models,
 * caps the batch at US$0.20 and checks inputs against the frozen v1 evidence.
 * Uses the real interpretation service with synthetic identity/data and an
 * in-memory store. No Neon, ANU or production-state connection. Credentials
 * enter through OPENAI_API_KEY in process memory, never through CLI arguments.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import { isDeepStrictEqual } from 'node:util';
import path from 'node:path';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from 'jose';
import { accessConfig } from '../../access/config.ts';
import { createAccessGuard } from '../../access/guard.ts';
import { createInterpretationsHandler } from '../../server/ai/service.mjs';
import { createOpenAIProvider } from '../../server/ai/provider.mjs';
import { AI_PROMPT_VERSION } from '../../server/ai/prompt.mjs';

const questions = Object.freeze({
  creation: '我有一个业余创作计划，想把自己画的城市观察整理成小册子，但总在准备和开工之间犹豫。怎样理解这个阶段的动力和阻力？',
  missingOptions: '我觉得自己站在人生的岔路口，但还说不清具体有哪些选择。我想借这几张牌看看，怎样才更容易看清眼前的问题？',
  unusual: '我想给一组雨后城市街角的照片写一句有余味的展览题记。请借这三张牌的意象，帮助我找到这句话的情绪和视角。',
});
const cases = [
  { caseId: 'creation-brief', questionId: 'creation', detail: 'brief', focus: 'general' },
  { caseId: 'creation-standard', questionId: 'creation', detail: 'standard', focus: 'general' },
  { caseId: 'creation-deep', questionId: 'creation', detail: 'deep', focus: 'general' },
  { caseId: 'creation-action', questionId: 'creation', detail: 'standard', focus: 'action' },
  { caseId: 'missing-options', questionId: 'missingOptions', detail: 'standard', focus: 'comparison' },
  { caseId: 'unusual-question', questionId: 'unusual', detail: 'standard', focus: 'general' },
];
const models = ['gpt-6.1-terra', 'gpt-6.1-sol'];
const args = process.argv.slice(2);
let destination, selectedCase;
while (args.length) {
  const flag = args.shift();
  if (flag === '--run' && destination === undefined) destination = args.shift();
  else if (flag === '--case' && selectedCase === undefined) selectedCase = args.shift();
  else throw new Error('Use [--case creation-deep] [--run <fresh .local directory>].');
  if (!destination && flag === '--run' || !selectedCase && flag === '--case') throw new Error(`Missing value for ${flag}.`);
}
if (selectedCase !== undefined && selectedCase !== 'creation-deep') throw new Error('The bounded follow-up supports only creation-deep.');
const baselinePath = new URL('../../docs/ai/stage2.5.11/results.json', import.meta.url);
const baselines = selectedCase ? JSON.parse(await readFile(baselinePath, 'utf8')).results.filter(item => item.caseId === selectedCase) : [];
if (selectedCase && (baselines.length !== models.length || !models.every(model => baselines.some(item => item.model === model && item.status === 'completed')))) {
  throw new Error('Frozen creation-deep evidence must contain both completed model results.');
}
// Alternate which model goes first per case; this is a small paired sample,
// not a statistical model ranking or an attempt to remove service variability.
const plan = cases.flatMap((item, index) => (index % 2 ? [...models].reverse() : models).map(model => ({
  ...item, model, effort: 'low', maxOutputTokens: 6000, reserveUSD: model.endsWith('terra') ? 0.05 : 0.09,
}))).filter(item => !selectedCase || item.caseId === selectedCase);
const generationLimit = plan.length, budgetUSD = selectedCase ? 0.20 : 1;
const reservedTotalUSD = Math.round(plan.reduce((sum, item) => sum + item.reserveUSD, 0) * 100) / 100;
for (const job of selectedCase ? plan : []) {
  const baseline = baselines.find(item => item.model === job.model);
  if (['detail', 'focus', 'effort', 'maxOutputTokens'].some(key => job[key] !== baseline[key]) || questions[job.questionId] !== baseline.input.question) {
    throw new Error('Follow-up settings or question differ from the frozen baseline.');
  }
}
if (!destination) {
  console.log(JSON.stringify({ syntheticOnly: true, generationLimit, budgetUSD, reservedTotalUSD,
    baseline: selectedCase ? 'docs/ai/stage2.5.11/results.json' : null,
    maximumInputTokens: 10000, promptVersion: AI_PROMPT_VERSION, questions, plan }, null, 2));
  process.exit(0);
}
const apiKey = process.env.OPENAI_API_KEY?.trim();
if (!apiKey) throw new Error('Provide a fresh .local result directory and an in-memory OPENAI_API_KEY.');
const root = await realpath(process.cwd()), local = await realpath(path.join(root, '.local'));
if (!local.startsWith(root + path.sep)) throw new Error('The local evidence root must stay inside this checkout.');
const directory = path.resolve(destination);
const parent = await realpath(path.dirname(directory));
if (parent !== local || path.basename(directory).startsWith('.')) throw new Error('Use a fresh direct child of this checkout’s .local directory.');
await mkdir(directory, { recursive: false, mode: 0o700 });
const save = (name, value) => writeFile(path.join(directory, name),
  (JSON.stringify(value, null, 2) + '\n').replaceAll(apiKey, '[REDACTED]'), { mode: 0o600 });
const ledger = { promptVersion: AI_PROMPT_VERSION, startedAt: new Date().toISOString(), budgetUSD, generationLimit,
  reservedUSD: 0, generations: 0, counts: 0, results: [], stopped: null };
await save('plan.json', { questions, plan, maximumInputTokens: 10000, selectedCase: selectedCase ?? null,
  baseline: selectedCase ? 'docs/ai/stage2.5.11/results.json' : null });
await save('ledger.json', ledger);
const entries = new Map();
const store = {
  async get(id) { return structuredClone(entries.get(id) ?? null); },
  async claim(attempt, hash) {
    const existing = entries.get(attempt.id);
    if (existing) return { attempt: structuredClone(existing), hash: existing.requestHash, inserted: false };
    entries.set(attempt.id, structuredClone(attempt)); return { attempt, hash, inserted: true };
  },
  async finish(id, result) { entries.set(id, structuredClone(result)); return result; },
};
const keys = await generateKeyPair('RS256');
const guard = createAccessGuard(createLocalJWKSet({ keys: [{ ...await exportJWK(keys.publicKey), kid: 'preset-evaluation', alg: 'RS256' }] }));
const token = await new SignJWT({ type: 'app', email: 'synthetic-local@example.test' })
  .setProtectedHeader({ alg: 'RS256', kid: 'preset-evaluation' }).setIssuer(accessConfig.issuer)
  .setAudience(accessConfig.audience).setSubject('synthetic-preset-evaluation')
  .setIssuedAt().setExpirationTime('1h').sign(keys.privateKey);
const origin = `https://${accessConfig.hostname}`;
let current, currentFile, returnedModel;
const provider = createOpenAIProvider(apiKey, { fetcher: async (url, init) => {
  const generation = url === 'https://api.openai.com/v1/responses';
  if (!generation && url !== 'https://api.openai.com/v1/responses/input_tokens') throw new Error('Unexpected provider endpoint.');
  const payload = JSON.parse(init.body);
  if (selectedCase) {
    const baseline = baselines.find(item => item.model === current.model);
    if (payload.model !== baseline.model || !isDeepStrictEqual(JSON.parse(payload.input), baseline.input) ||
      payload.reasoning?.effort !== baseline.effort || generation && payload.max_output_tokens !== baseline.maxOutputTokens) {
      throw new Error('Follow-up payload differs from the frozen baseline; provider dispatch blocked.');
    }
  }
  await save(`${currentFile}-${generation ? 'request' : 'count-request'}.json`, payload);
  if (generation) {
    if (ledger.generations >= generationLimit || ledger.reservedUSD + current.reserveUSD > budgetUSD) throw new Error('Evaluation budget exhausted.');
    ledger.generations++;
    ledger.reservedUSD = Math.round((ledger.reservedUSD + current.reserveUSD) * 100) / 100;
  } else {
    if (ledger.counts >= generationLimit) throw new Error('Evaluation input-count limit exhausted.');
    ledger.counts++;
  }
  // Record before dispatch. Unknown/interrupted operations keep their full
  // reservation; rerunning into this directory is deliberately forbidden.
  await save('ledger.json', ledger);
  const response = await fetch(url, init);
  const raw = await response.clone().json().catch(() => null);
  await save(`${currentFile}-${generation ? 'provider' : 'count'}.json`, { httpStatus: response.status, response: raw });
  if (generation) returnedModel = raw?.model ?? null;
  return response;
} });
const service = createInterpretationsHandler({ accessGuard: guard, getStore: async () => store, getProvider: async () => provider });
const post = input => new Request(`${origin}/api/interpretations`, { method: 'POST',
  headers: { 'cf-access-jwt-assertion': token, origin, 'content-type': 'application/json' }, body: JSON.stringify(input) });
const sessionId = randomUUID(), startedAt = new Date().toISOString();
for (const [index, job] of plan.entries()) {
  current = job; returnedModel = null;
  currentFile = `${String(index + 1).padStart(2, '0')}-${job.model}-${job.caseId}`;
  const reading = {
    schemaVersion: 1, id: sessionId, startedAt, question: questions[job.questionId],
    interpretation: '', reflection: '', spread: { type: 'free', name: '自由摆牌' },
    cards: [0, 1, 2].map(n => ({ physicalId: n, sourceCardId: `major-0${n}`, faceUp: true,
      reversed: n === 1, x: n * 2 - 2, z: -0.5, drawOrder: n + 1, zIndex: n + 1, positionLabel: '' })),
  };
  const input = { id: randomUUID(), reading, model: job.model, effort: job.effort,
    maxOutputTokens: job.maxOutputTokens, detail: job.detail, focus: job.focus };
  await save(`${currentFile}-input.json`, input);
  const began = performance.now();
  const response = await service(post(input));
  const result = await response.json();
  await save(`${currentFile}-result.json`, { httpStatus: response.status, result });
  const item = { caseId: job.caseId, model: job.model, returnedModel, detail: job.detail, focus: job.focus,
    effort: job.effort, maxOutputTokens: job.maxOutputTokens, httpStatus: response.status,
    status: result.interpretation?.status ?? result.error?.code,
    elapsedSeconds: Math.round((performance.now() - began) / 100) / 10,
    usage: result.interpretation?.usage ?? null };
  ledger.results.push(item); await save('ledger.json', ledger);
  console.log(JSON.stringify(item));
  const before = { generations: ledger.generations, counts: ledger.counts };
  const lookup = await service(new Request(`${origin}/api/interpretations?id=${input.id}`, { headers: { 'cf-access-jwt-assertion': token } }));
  const replay = await service(post(input));
  await save(`${currentFile}-replay.json`, { lookupStatus: lookup.status, lookup: await lookup.json(),
    replayStatus: replay.status, replay: await replay.json(), countsBefore: before,
    countsAfter: { generations: ledger.generations, counts: ledger.counts } });
  if (before.generations !== ledger.generations || before.counts !== ledger.counts) {
    ledger.stopped = 'Replay dispatched an unexpected provider request.';
  } else if (item.status !== 'completed') {
    ledger.stopped = 'Noncompleted result; no retry or further evaluation.';
  } else if (returnedModel !== job.model && !String(returnedModel).startsWith(`${job.model}-`)) {
    ledger.stopped = 'Returned model mismatch; no further evaluation.';
  }
  if (ledger.stopped) { await save('ledger.json', ledger); break; }
}
ledger.finishedAt = new Date().toISOString();
await save('ledger.json', ledger);
console.log(JSON.stringify({ completed: ledger.results.filter(item => item.status === 'completed').length,
  generations: ledger.generations, counts: ledger.counts, reservedUSD: ledger.reservedUSD, stopped: ledger.stopped }));
if (ledger.stopped) process.exitCode = 1;
