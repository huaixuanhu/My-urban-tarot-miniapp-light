/** Local validation only. One durable dispatch budget; never imported by production. */
import { readFile, open, mkdir, lstat } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createANUProvider, RandomProviderError } from '../../server/random/provider.mjs';

async function privateWrite(file, bytes) {
  const handle = await open(file, 'wx', 0o600);
  try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
}
export async function createOneShotANUProvider({ keyFile, evidenceDirectory, fetcher = fetch }) {
  const metadata = await lstat(keyFile);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 8192 || (metadata.mode & 0o077)) throw new Error('ANU_KEY_FILE_NOT_PRIVATE');
  const { ANU_API_KEY: key } = parseEnv(await readFile(keyFile, 'utf8'));
  if (!key?.trim() || /[\r\n]/.test(key)) throw new Error('ANU_KEY_NOT_CONFIGURED');
  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  const marker = path.join(evidenceDirectory, 'attempt.json');
  const provider = createANUProvider(key, async (url, options) => {
    // Durable marker precedes the network boundary, including timeout/failure.
    try { await privateWrite(marker, JSON.stringify({ schemaVersion: 1, startedAt: new Date().toISOString(), maximumRequests: 1 })); }
    catch (error) { if (error.code === 'EEXIST') throw new RandomProviderError('rejected'); throw error; }
    const directory = await open(evidenceDirectory, 'r');
    try { await directory.sync(); } finally { await directory.close(); }
    const started = performance.now();
    let response;
    try { response = await fetcher(url, options); }
    catch {
      await privateWrite(path.join(evidenceDirectory, 'transport.json'), JSON.stringify({ outcome: 'unknown', elapsedMs: Math.round(performance.now() - started) }));
      throw new RandomProviderError('unknown');
    }
    const chunks = []; let size = 0;
    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.byteLength;
          if (size > 32768) { await reader.cancel(); throw new RandomProviderError('invalid_response'); }
          chunks.push(value);
        }
      } finally { reader.releaseLock(); }
    }
    const bytes = Buffer.concat(chunks), fetchedAt = new Date().toISOString();
    await privateWrite(path.join(evidenceDirectory, 'response.json'), bytes);
    await privateWrite(path.join(evidenceDirectory, 'receipt.json'), JSON.stringify({
      schemaVersion: 1, provider: 'ANU', httpStatus: response.status, fetchedAt,
      elapsedMs: Math.round(performance.now() - started), bytes: bytes.length,
      responseSha256: createHash('sha256').update(bytes).digest('hex'),
    }, null, 2));
    return new Response(bytes.length ? bytes : null, { status: response.status, headers: { 'content-type': response.headers.get('content-type') || 'application/json' } });
  });
  return provider;
}
