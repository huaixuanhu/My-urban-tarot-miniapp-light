/** Non-acquiring checks of an already running local ANU harness. No keys read. */
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import http from 'node:http';
const port = Number(process.argv[2] || 5176), origin = `http://127.0.0.1:${port}`;
const before = await (await fetch(`${origin}/api/_local-status`)).json();
assert.equal(before.local, true);
const directory = await mkdtemp(path.resolve('.local/anu-live/http-check-'));
const file = path.join(directory, 'private.txt'), sentinel = `private-${randomUUID()}`;
await writeFile(file, sentinel, { mode: 0o600 });
const outcomes = [];
try {
  const paths = [`/@fs/${file}`, `/@fs/${file}?raw`, `/@fs/${file}?url`, `/@fs/${file.replace('.local', '%2elocal')}`, `/${path.relative(process.cwd(), file)}`];
  for (const [index, target] of paths.entries()) {
    const response = await fetch(`${origin}${target}`), body = await response.text();
    assert.notEqual(body.includes(sentinel), true, `private sentinel leaked at variant ${index}`);
    if (index < 4) assert.equal(response.status, 403, `Filesystem variant ${index} must be denied.`);
    else assert.equal(response.status, 200, 'SPA path returns only the public HTML shell.');
    outcomes.push({ privatePathVariant: index, status: response.status, leaked: false });
  }
  // Fetch may normalize the Host header; use raw local HTTP for this check.
  const badHostStatus = await new Promise((resolve, reject) => {
    const request = http.get(`${origin}/api/_local-status`, { headers: { host: 'untrusted.example' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(badHostStatus, 403);
  const badOrigin = await fetch(`${origin}/api/random`, { method: 'POST', headers: { origin: 'https://untrusted.example', 'content-type': 'application/json' }, body: JSON.stringify({ action: 'collect', id: randomUUID() }) });
  assert.equal(badOrigin.status, 403);
  const ai = await fetch(`${origin}/api/interpretations`); assert.equal(ai.status, 503);
  const after = await (await fetch(`${origin}/api/_local-status`)).json();
  assert.equal(after.requestBudgetUsed, before.requestBudgetUsed);
  console.log(JSON.stringify({ privatePaths: outcomes, host: 403, writeOrigin: 403, ai: 503, acquisitionBudgetUnchanged: true }, null, 2));
} finally { await rm(directory, { recursive: true, force: true }); }
