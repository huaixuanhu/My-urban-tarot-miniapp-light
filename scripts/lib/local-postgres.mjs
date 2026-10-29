/** Local-only PostgreSQL bridge. Never reads app env files or connects to cloud. */
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { access, lstat, mkdir, mkdtemp, open, readFile, readdir, rm, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';

const run = promisify(execFile);
const exists = async file => { try { await access(file); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; } };

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

/**
 * A supplied directory is retained across orderly stops; otherwise disposable.
 * Migrations are explicitly supplied and applied only to a newly created cluster.
 * An incomplete initialization is preserved and refused, never silently retried.
 * An exclusive lifecycle lock spans initialization through shutdown. Stale locks
 * require explicit inspection; the helper never takes over another process.
 */
export async function openLocalPostgres({ directory, migrations = [] } = {}) {
  const temporary = directory === undefined;
  const root = temporary ? await mkdtemp('/private/tmp/augurwell-pg-') : path.resolve(directory);
  await mkdir(root, { recursive: true, mode: 0o700 });
  const data = path.join(root, 'data'), manifestPath = path.join(root, 'local-initialized.json');
  const lockPath = path.join(root, 'local-lifecycle.lock');
  let socket, lock, closing;
  const bin = name => process.env.POSTGRES_BIN_DIR ? path.join(process.env.POSTGRES_BIN_DIR, name) : name;
  const env = { PATH: process.env.PATH, LANG: 'C', LC_ALL: 'C' };
  const options = { env, maxBuffer: 4 * 1024 * 1024 };
  let started = false, closed = false, startAttempted = false;

  async function execute(input) {
    if (!started || closed) throw new Error('Local PostgreSQL is not running.');
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
    const input = `${transaction ? 'BEGIN ISOLATION LEVEL READ COMMITTED;\n' : ''}${queries.map((query, i) => `\\echo ${marker}_${i}\n${query};`).join('\n')}\n${transaction ? 'COMMIT;\n' : ''}`;
    const output = await execute(input);
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

  async function close() {
    if (closed) return;
    if (closing) return closing;
    closing = (async () => {
      // A terminal interrupt can also reach the child server. Accept an already
      // stopped owned server only with both negative status and no PID marker.
      // Alive or ambiguous outcomes retain the lifecycle lock for inspection.
      if (started) {
        try { await run(bin('pg_ctl'), ['-D', data, '-m', 'fast', '-w', 'stop'], options); }
        catch (stopError) {
          let confirmedStopped = false;
          try { await run(bin('pg_ctl'), ['-D', data, 'status'], options); }
          catch (statusError) {
            if (statusError.code === 3 && !await exists(path.join(data, 'postmaster.pid'))) confirmedStopped = true;
            else throw new AggregateError([stopError, statusError], 'Local PostgreSQL shutdown outcome is unknown; lifecycle lock preserved.');
          }
          if (!confirmedStopped) throw stopError;
        }
        started = false;
      }
      if (socket) { await rm(socket, { recursive: true, force: true }); socket = undefined; }
      if (lock) {
        const owned = await lock.stat(), current = await lstat(lockPath);
        if (owned.dev !== current.dev || owned.ino !== current.ino) throw new Error('Local PostgreSQL lifecycle lock ownership changed; preserved for inspection.');
        await lock.close();
        await unlink(lockPath);
        lock = undefined;
        if (temporary) await rm(root, { recursive: true, force: true });
      }
      closed = true;
    })();
    try { await closing; } finally { closing = undefined; }
  }

  try {
    try { lock = await open(lockPath, 'wx', 0o600); }
    catch (error) {
      if (error.code === 'EEXIST') throw new Error('Local PostgreSQL lifecycle lock exists; another preview may be running. Inspect before removing a stale lock.');
      throw error;
    }
    await lock.writeFile(`${JSON.stringify({ pid: process.pid, owner: randomUUID(), createdAt: new Date().toISOString() })}\n`);
    await lock.sync();
    // No socket/startup resources are created until this process owns the lock.
    socket = await mkdtemp('/private/tmp/augurwell-pg-socket-');
    const contents = await Promise.all(migrations.map(async file => ({ text: await readFile(file, 'utf8') })));
    const hashes = contents.map(({ text }) => createHash('sha256').update(text).digest('hex'));
    // Never attach to or stop a server started by another preview. A leftover
    // PID file requires inspection after a crash; do not assume it is stale.
    if (await exists(path.join(data, 'postmaster.pid'))) throw new Error('Local PostgreSQL already has a process marker; inspect it before restarting.');
    const created = !await exists(path.join(data, 'PG_VERSION'));
    if (created) {
      if (await exists(data) && (await readdir(data)).length) throw new Error('Local PostgreSQL initialization is incomplete; preserved for inspection.');
      await run(bin('initdb'), ['-D', data, '--auth=trust', '-U', 'postgres', '--locale=C', '-E', 'UTF8'], options);
    } else {
      if (!await exists(manifestPath)) throw new Error('Local PostgreSQL migration receipt is missing; existing data was not modified.');
      const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
      if (manifest.version !== 1 || JSON.stringify(manifest.migrations) !== JSON.stringify(hashes)) throw new Error('Local PostgreSQL migration receipt differs; explicit review required.');
    }
    startAttempted = true;
    await run(bin('pg_ctl'), ['-D', data, '-l', path.join(root, 'server.log'), '-o', `-k ${socket} -p 55439 -c listen_addresses='' -c fsync=on -c synchronous_commit=on`, '-w', 'start'], options);
    started = true;
    if (created) {
      for (const { text } of contents) await execute(text);
      await writeFile(manifestPath, `${JSON.stringify({ version: 1, migrations: hashes })}\n`, { mode: 0o600, flag: 'wx' });
    }
    return { sql, execute, created, directory: root, close };
  } catch (error) {
    if (startAttempted && !started) {
      // A startup timeout can leave our server alive. Resolve that before
      // removing a disposable cluster. The exclusive lock and PID check ensure
      // any server started here belongs to this invocation.
      try { await run(bin('pg_ctl'), ['-D', data, 'status'], options); started = true; }
      catch (statusError) { if (statusError.code !== 3) throw new AggregateError([error, statusError], 'Local PostgreSQL startup outcome is unknown; files preserved.'); }
    }
    await close();
    throw error;
  }
}
