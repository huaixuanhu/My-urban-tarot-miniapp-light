// Local build tool only. Never imported by the reading application.
import { createRequire } from 'node:module';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = dirname(fileURLToPath(import.meta.url));
const cottage = resolve(process.env.COTTAGE_WEB_ROOT || join(root, '../../../../萱敏小屋/web'));
const require = createRequire(join(cottage, 'package.json'));
const { createServer } = await import(pathToFileURL(require.resolve('vite')));
const { default: react } = await import(pathToFileURL(require.resolve('@vitejs/plugin-react')));
const output = resolve(root, '../assets');
const evidence = resolve(root, '../../../docs/design/stage2.4.12');
const manifest = JSON.parse(await readFile(join(root, 'source-manifest.json'), 'utf8'));
for (const file of manifest.files) {
  const bytes = await readFile(join(root, file.snapshot));
  if (createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`Source snapshot changed: ${file.snapshot}`);
}
const aliases = ['react', 'react-dom', 'three', '@react-three/fiber', '@react-three/drei'].map(name => ({
  find: name, replacement: realpathSync(join(cottage, 'node_modules', name)),
}));
const server = await createServer({
  configFile: false, root, plugins: [react(), {
    name: 'bounded-cottage-export-save',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = /^\/__save\/(day|night)$/.exec(req.url || '');
        if (!match) return next();
        if (req.method !== 'POST' || req.headers.origin !== 'http://127.0.0.1:5175') {
          res.writeHead(403); return res.end('Local exporter origin required.');
        }
        try {
          const parts = []; let count = 0;
          for await (const chunk of req) { count += chunk.length; if (count > 120 * 1024 * 1024) throw new Error('Export exceeded 120 MiB.'); parts.push(chunk); }
          const payload = JSON.parse(Buffer.concat(parts).toString('utf8'));
          const binary = Buffer.from(payload.glb, 'base64');
          if (binary.toString('ascii', 0, 4) !== 'glTF' || binary.readUInt32LE(4) !== 2 || binary.readUInt32LE(8) !== binary.length) throw new Error('Invalid GLB envelope.');
          const theme = match[1], filename = `cottage-${theme}.glb`;
          const sha256 = createHash('sha256').update(binary).digest('hex');
          const report = { ...payload.report, theme, sourceCommit: manifest.sourceCommit, filename, bytes: binary.length, sha256, verifiedAt: new Date().toISOString() };
          await mkdir(output, {recursive:true}); await mkdir(evidence, {recursive:true});
          await writeFile(join(output, filename), binary);
          await writeFile(join(evidence, `cottage-${theme}-export.json`), JSON.stringify(report,null,2)+'\n');
          res.writeHead(200, {'Content-Type':'application/json'}); res.end(JSON.stringify(report));
        } catch (error) { res.writeHead(400); res.end(String(error)); }
      });
    },
  }],
  resolve: { alias: aliases, dedupe: ['three', 'react', 'react-dom'] },
  server: {host:'127.0.0.1', port:5175, strictPort:true, fs:{allow:[root, cottage]}},
});
await server.listen(); server.printUrls();
