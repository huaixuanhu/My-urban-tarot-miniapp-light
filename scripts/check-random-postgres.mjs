/**
 * Local PostgreSQL verification of the actual production pool adapter SQL.
 * Creates/removes one private temporary cluster; never reads app env files,
 * contacts Neon/ANU, or applies a migration to an existing database.
 * Requires initdb, pg_ctl and psql on PATH (or POSTGRES_BIN_DIR).
 */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createRandomStoreFromSql } from '../server/random/neon-store.mjs';
import { generateDeck } from '../shared/randomness.mjs';

const execute = promisify(execFile);
const root = await mkdtemp('/private/tmp/augurwell-pg-');
const data = path.join(root, 'data'), socket = path.join(root, 'socket');
const bin = name => process.env.POSTGRES_BIN_DIR ? path.join(process.env.POSTGRES_BIN_DIR, name) : name;
const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' };
const options = { env, maxBuffer: 4 * 1024 * 1024 };
let started = false;
const passed = [];

// psql emits CSV without interpreting result projections. The adapter's SQL
// strings and transaction statement boundaries are executed unchanged.
function parseCSV(text) {
  const rows = []; let row = [], value = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ',') { row.push(value); value = ''; }
    else if (!quoted && char === '\n') { row.push(value); rows.push(row); row = []; value = ''; }
    else if (char !== '\r' || quoted) value += char;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}
function deserialize(name, value) {
  if (value === '') return null;
  if (['document', 'values_json'].includes(name)) return JSON.parse(value);
  if (name === 'cursor') return Number(value);
  if (name === 'singleton') return value === 't';
  return value;
}
function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') { assert(Number.isFinite(value)); return String(value); }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  assert.equal(typeof value, 'string');
  return `'${value.replaceAll("'", "''")}'`;
}
async function psql(input) {
  const child = execFile(bin('psql'), ['-X', '-q', '--csv', '-P', 'footer=off', '-v', 'ON_ERROR_STOP=1',
    '-h', socket, '-p', '55439', '-U', 'postgres', '-d', 'postgres'], options);
  const result = new Promise((resolve, reject) => {
    let stdout = '', stderr = '';
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve(stdout) : reject(new Error(`Local psql failed (${code}): ${stderr}`)));
  });
  child.stdin.end(input);
  return result;
}
async function runQueries(queries, transaction) {
  const marker = `result_${randomUUID()}`;
  const input = `${transaction ? 'BEGIN;\n' : ''}${queries.map((query, i) => `\\echo ${marker}_${i}\n${query};`).join('\n')}\n${transaction ? 'COMMIT;\n' : ''}`;
  const output = await psql(input);
  return queries.map((_, i) => {
    const start = output.indexOf(`${marker}_${i}\n`);
    assert(start >= 0, 'missing result delimiter');
    const next = output.indexOf(`${marker}_${i + 1}\n`, start + 1);
    const segment = output.slice(start + marker.length + String(i).length + 2, next < 0 ? undefined : next);
    const [columns = [], ...rows] = parseCSV(segment);
    return rows.filter(row => row.length === columns.length).map(row => Object.fromEntries(columns.map((name, j) => [name, deserialize(name, row[j])])));
  });
}
function sql(strings, ...values) {
  const text = strings.reduce((result, part, i) => result + part + (i < values.length ? literal(values[i]) : ''), '');
  return { text, then(resolve, reject) { return runQueries([text], false).then(rows => rows[0]).then(resolve, reject); } };
}
sql.transaction = queries => runQueries(queries.map(query => query.text), true);

const store = createRandomStoreFromSql(sql);
const at = () => new Date().toISOString();
async function claim(action) {
  const operation = { id: randomUUID(), action, status: 'pending', createdAt: at(), createdBy: 'local-synthetic-review' };
  assert.equal((await store.claim(operation)).inserted, true);
  return operation;
}
async function seed(values = Array(1024).fill(0)) {
  // Test clock preparation only; production never edits the acquisition clock.
  await psql('UPDATE augurwell_random_pool SET last_collect_started = NULL;');
  const op = await claim('collect');
  assert.equal(await store.startCollection(op.id), true);
  assert.equal((await store.completeCollection(op.id, values, at())).status, 'completed');
  return op;
}
function candidate(pool, requestId) {
  const value = generateDeck(pool.values, pool.cursor);
  return { order: value.order, reversed: value.reversed,
    randomness: { source: 'anu', requestId, batchId: pool.batchId, fetchedAt: pool.fetchedAt, consumed: value.consumed } };
}
async function check(name, action) { await action(); passed.push(name); }

try {
  await mkdir(socket, { mode: 0o700 });
  await execute(bin('initdb'), ['-D', data, '--auth=trust', '-U', 'postgres', '--locale=C', '-E', 'UTF8'], options);
  await execute(bin('pg_ctl'), ['-D', data, '-l', path.join(root, 'server.log'), '-o', `-k ${socket} -p 55439 -c listen_addresses='' -c fsync=off`, '-w', 'start'], options);
  started = true;
  const migration = await readFile(new URL('../server/random/003-create-random-pool.sql', import.meta.url), 'utf8');
  await psql(migration);

  await check('actual migration creates empty durable inventory', async () => {
    const pool = await store.getPool();
    assert.deepEqual(pool.values, []); assert.equal(pool.cursor, 0); assert.equal(pool.batchId, null);
  });
  await check('duplicate concurrent claim has exactly one owner', async () => {
    const op = { id: randomUUID(), action: 'draw', status: 'pending', createdAt: at(), createdBy: 'local-synthetic-review' };
    const claims = await Promise.all(Array.from({ length: 8 }, () => store.claim(op)));
    assert.equal(claims.filter(result => result.inserted).length, 1);
    assert(claims.every(result => result.operation.id === op.id));
  });
  await seed();
  await check('two users competing on one cursor can commit only one candidate', async () => {
    const ops = await Promise.all([claim('draw'), claim('draw')]), pool = await store.getPool();
    const attempts = await Promise.all(ops.map(op => store.commitDraw(op.id, pool.version, 155, candidate(pool, op.id), at())));
    assert.equal(attempts.filter(Boolean).length, 1);
    assert.equal((await store.getPool()).cursor, 155);
    const loser = ops[attempts[0] ? 1 : 0], next = await store.getPool();
    assert.equal((await store.commitDraw(loser.id, next.version, 155, candidate(next, loser.id), at())).status, 'completed');
    assert.equal((await store.getPool()).cursor, 310);
  });
  await check('duplicate draw completion never deducts twice', async () => {
    const op = await claim('draw'), pool = await store.getPool(), deck = candidate(pool, op.id);
    const results = await Promise.all(Array.from({ length: 6 }, () => store.commitDraw(op.id, pool.version, 155, deck, at())));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal((await store.getPool()).cursor, pool.cursor + 155);
    assert.deepEqual((await store.get(op.id)).deck, deck);
  });
  await check('collect ownership and one-second rate interval are shared across connections', async () => {
    await psql('UPDATE augurwell_random_pool SET last_collect_started = NULL;');
    const ops = await Promise.all([claim('collect'), claim('collect')]);
    const results = await Promise.all(ops.map(op => store.startCollection(op.id)));
    assert.equal(results.filter(Boolean).length, 1);
    const winner = ops[results[0] ? 0 : 1], loser = ops[results[0] ? 1 : 0];
    await store.fail(winner.id, 'failed', 'synthetic provider failure', at());
    assert.equal(await store.startCollection(loser.id), false);
  });
  await check('failed replacement preserves old batch, data, timestamp and cursor', async () => {
    await psql('UPDATE augurwell_random_pool SET last_collect_started = NULL;');
    const before = await store.getPool(), op = await claim('collect');
    assert.equal(await store.startCollection(op.id), true);
    await store.fail(op.id, 'unknown', 'synthetic response loss', at());
    const after = await store.getPool();
    for (const key of ['batchId', 'fetchedAt', 'cursor', 'version', 'values']) assert.deepEqual(after[key], before[key]);
  });
  await check('expired collector is fenced and cannot overwrite a newer acquisition', async () => {
    await psql('UPDATE augurwell_random_pool SET last_collect_started = NULL;');
    const old = await claim('collect'); assert.equal(await store.startCollection(old.id), true);
    await psql("UPDATE augurwell_random_pool SET collect_started = CURRENT_TIMESTAMP - interval '61 seconds', last_collect_started = CURRENT_TIMESTAMP - interval '61 seconds';");
    const current = await claim('collect'); assert.equal(await store.startCollection(current.id), true);
    const values = Array.from({ length: 1024 }, (_, i) => i);
    assert.equal((await store.completeCollection(current.id, values, at())).status, 'completed');
    assert.equal(await store.completeCollection(old.id, Array(1024).fill(1), at()), null);
    await store.fail(old.id, 'unknown', 'superseded', at());
    const pool = await store.getPool();
    assert.equal(pool.batchId, current.id); assert.deepEqual(pool.values, values); assert.equal(pool.cursor, 0);
  });
  await check('replacement invalidates old-version draw without partial inventory change', async () => {
    const op = await claim('draw'), old = await store.getPool(), deck = candidate(old, op.id);
    const replacement = await seed();
    assert.equal(await store.commitDraw(op.id, old.version, 155, deck, at()), null);
    const current = await store.getPool();
    assert.equal(current.batchId, replacement.id); assert.equal(current.cursor, 0);
    assert.equal((await store.get(op.id)).status, 'pending');
  });
  await check('insufficient capacity cannot commit partial draw or consume extra inventory', async () => {
    for (let i = 0; i < 6; i++) {
      const op = await claim('draw'), pool = await store.getPool();
      assert.equal((await store.commitDraw(op.id, pool.version, 155, candidate(pool, op.id), at())).status, 'completed');
    }
    const op = await claim('draw'), pool = await store.getPool();
    assert.equal(pool.cursor, 930);
    assert.equal(await store.commitDraw(op.id, pool.version, 155, { synthetic: true }, at()), null);
    assert.equal((await store.getPool()).cursor, 930);
    assert.equal((await store.get(op.id)).status, 'pending');
  });
  await check('pool and operation updates roll back together on SQL constraint failure', async () => {
    await psql('UPDATE augurwell_random_pool SET last_collect_started = NULL;');
    const before = await store.getPool(), op = await claim('collect');
    assert.equal(await store.startCollection(op.id), true);
    await assert.rejects(() => store.completeCollection(op.id, [1], at()));
    const after = await store.getPool();
    assert.equal(after.cursor, before.cursor); assert.equal(after.batchId, before.batchId);
    assert.equal(after.collectId, op.id); assert.equal((await store.get(op.id)).status, 'pending');
    await store.fail(op.id, 'failed', 'invalid fixture', at());
  });
  await check('expiry racing draw completion has one terminal winner and matching inventory deduction', async () => {
    await seed();
    for (let i = 0; i < 6; i++) {
      const op = await claim('draw'), before = await store.getPool(), deck = candidate(before, op.id);
      const finish = () => store.commitDraw(op.id, before.version, 155, deck, at());
      const expire = () => store.fail(op.id, 'unknown', 'synthetic expiry race', at());
      await Promise.all(i % 2 ? [expire(), finish()] : [finish(), expire()]);
      const terminal = await store.get(op.id), after = await store.getPool();
      assert(['completed', 'unknown'].includes(terminal.status));
      assert.equal(after.cursor, before.cursor + (terminal.status === 'completed' ? 155 : 0));
      assert.equal(after.version, terminal.status === 'completed' ? String(BigInt(before.version) + 1n) : before.version);
      if (terminal.status === 'completed') assert.deepEqual(terminal.deck, deck);
      else assert.equal(terminal.deck, undefined);
    }
  });
  await check('expiry racing collection completion replaces inventory only when completion wins', async () => {
    for (let i = 0; i < 6; i++) {
      await psql('UPDATE augurwell_random_pool SET last_collect_started = NULL;');
      const before = await store.getPool(), op = await claim('collect'), values = Array(1024).fill(i + 1);
      assert.equal(await store.startCollection(op.id), true);
      const finish = () => store.completeCollection(op.id, values, at());
      const expire = () => store.fail(op.id, 'unknown', 'synthetic expiry race', at());
      await Promise.all(i % 2 ? [expire(), finish()] : [finish(), expire()]);
      const terminal = await store.get(op.id), after = await store.getPool();
      assert(['completed', 'unknown'].includes(terminal.status));
      assert.equal(after.collectId, null);
      if (terminal.status === 'completed') {
        assert.equal(after.batchId, op.id); assert.equal(after.cursor, 0); assert.deepEqual(after.values, values);
        assert.equal(after.version, String(BigInt(before.version) + 1n));
      } else {
        for (const key of ['batchId', 'fetchedAt', 'cursor', 'version', 'values']) assert.deepEqual(after[key], before[key]);
      }
    }
  });
  console.log(JSON.stringify({ localPostgres: true, migrationSha256: createHash('sha256').update(migration).digest('hex'),
    tests: passed.length, passed, externalRequests: 0, productionDatabaseTouched: false }, null, 2));
} finally {
  if (started) await execute(bin('pg_ctl'), ['-D', data, '-m', 'immediate', '-w', 'stop'], options);
  await rm(root, { recursive: true, force: true });
}
