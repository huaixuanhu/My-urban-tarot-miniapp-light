import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

await mkdir('.local', { recursive: true });
const output = await mkdtemp(path.resolve('.local/records-runtime-'));
try {
  const file = path.join(output, 'records.mjs');
  await build({ entryPoints: ['api/records.ts'], outfile: file, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const { default: api } = await import(pathToFileURL(file));
  const response = await api.fetch(new Request('https://augurwell.anoriaquant.dev/api/records'));
  if (response.status !== 403 || (await response.json()).error?.code !== 'ACCESS_REQUIRED') throw new Error('Compiled records API must reject anonymous access.');
  console.log('PASS: compiled records API loads and rejects anonymous access before storage.');
} finally { await rm(output, { recursive: true, force: true }); }
