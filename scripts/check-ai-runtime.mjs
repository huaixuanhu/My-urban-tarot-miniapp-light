import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/ai-runtime-'));
try {
  const file = path.join(output, 'interpretations.mjs');
  await build({ entryPoints: ['api/interpretations.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const { default: api } = await import(pathToFileURL(file));
  const response = await api.fetch(new Request('https://augurwell.anoriaquant.dev/api/interpretations'));
  if (response.status !== 403 || (await response.json()).error?.code !== 'ACCESS_REQUIRED') throw new Error('Compiled AI API must reject anonymous access before storage/provider access.');
  console.log('PASS: compiled AI API loads and rejects anonymous access before storage/provider access.');
} finally { await rm(output, { recursive: true, force: true }); }
