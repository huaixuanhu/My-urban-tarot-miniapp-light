import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, chmod } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createOneShotANUProvider } from '../scripts/lib/anu-live-provider.mjs';
const reply = () => new Response(JSON.stringify({ success: true, type: 'uint16', length: 1024, data: Array(1024).fill(12345) }), { headers: { 'content-type': 'application/json' } });
async function fixture(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'anu-budget-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const keyFile = path.join(directory, 'fake.env'), evidenceDirectory = path.join(directory, 'evidence');
  await writeFile(keyFile, 'ANU_API_KEY="offline-test-key"\n', { mode: 0o600 });
  return { keyFile, evidenceDirectory };
}
test('one real-provider-shaped request, durable marker before fetch, no repeat across instances', async t => {
  const paths = await fixture(t); let calls = 0;
  const fetcher = async (url, options) => {
    calls++;
    assert.equal(url, 'https://api.quantumnumbers.anu.edu.au?type=uint16&length=1024');
    assert.equal(options.headers['x-api-key'], 'offline-test-key');
    assert.equal(JSON.parse(await readFile(path.join(paths.evidenceDirectory, 'attempt.json'))).maximumRequests, 1);
    return reply();
  };
  const one = await createOneShotANUProvider({ ...paths, fetcher });
  const two = await createOneShotANUProvider({ ...paths, fetcher });
  const results = await Promise.allSettled([one.collect(), two.collect()]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  assert.equal(calls, 1);
  const restarted = await createOneShotANUProvider({ ...paths, fetcher });
  await assert.rejects(() => restarted.collect()); assert.equal(calls, 1);
  const receipt = JSON.parse(await readFile(path.join(paths.evidenceDirectory, 'receipt.json')));
  assert.equal(receipt.httpStatus, 200); assert.match(receipt.responseSha256, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(receipt).includes('offline-test-key'), false);
  assert.equal(JSON.parse(await readFile(path.join(paths.evidenceDirectory, 'response.json'))).data.length, 1024);
});
test('transport failure spends the budget and never leaks request secrets in evidence', async t => {
  const paths = await fixture(t); let calls = 0;
  const fetcher = async () => { calls++; throw new Error('offline-test-key network detail'); };
  const provider = await createOneShotANUProvider({ ...paths, fetcher });
  await assert.rejects(() => provider.collect(), { message: 'unknown' });
  const restarted = await createOneShotANUProvider({ ...paths, fetcher });
  await assert.rejects(() => restarted.collect()); assert.equal(calls, 1);
  const receipt = await readFile(path.join(paths.evidenceDirectory, 'transport.json'), 'utf8');
  assert.equal(receipt.includes('offline-test-key'), false); assert.equal(JSON.parse(receipt).outcome, 'unknown');
});
test('invalid live response is retained privately for offline diagnosis without another call', async t => {
  const paths = await fixture(t); let calls = 0;
  const provider = await createOneShotANUProvider({ ...paths, fetcher: async () => { calls++; return new Response('{"format":"unexpected"}'); } });
  await assert.rejects(() => provider.collect(), { kind: 'invalid_response' });
  assert.deepEqual(JSON.parse(await readFile(path.join(paths.evidenceDirectory, 'response.json'))), { format: 'unexpected' });
  await assert.rejects(() => provider.collect()); assert.equal(calls, 1);
});
test('oversize response stays bounded and cannot be retried', async t => {
  const paths = await fixture(t); let calls = 0;
  const provider = await createOneShotANUProvider({ ...paths, fetcher: async () => { calls++; return new Response('x'.repeat(32769)); } });
  await assert.rejects(() => provider.collect()); await assert.rejects(() => provider.collect());
  assert.equal(calls, 1);
  await assert.rejects(readFile(path.join(paths.evidenceDirectory, 'response.json')), { code: 'ENOENT' });
});
test('blank or publicly readable key file refuses before any external work', async t => {
  const paths = await fixture(t); let calls = 0;
  const options = { ...paths, fetcher: async () => { calls++; return reply(); } };
  await chmod(paths.keyFile, 0o644);
  await assert.rejects(createOneShotANUProvider(options), { message: 'ANU_KEY_FILE_NOT_PRIVATE' });
  await chmod(paths.keyFile, 0o600); await writeFile(paths.keyFile, 'ANU_API_KEY=\n');
  await assert.rejects(createOneShotANUProvider(options), { message: 'ANU_KEY_NOT_CONFIGURED' });
  assert.equal(calls, 0);
});
