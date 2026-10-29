import path from "node:path";
import { defineConfig, type PreviewServer, type ViteDevServer } from "vite";

// Vite does not execute protected Vercel Functions. Explicitly report this local
// boundary instead of serving index.html or pretending a memory store is cloud.
function localRecordsUnavailable(server: ViteDevServer | PreviewServer) {
  server.middlewares.use('/api/records', (_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: { code: 'RECORDS_NOT_CONFIGURED', message: '本地预览尚未连接云端记录，内容没有提交。可以先体验填写与面板交互。' } }));
  });
  server.middlewares.use('/api/random', (_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: { code: 'RANDOM_NOT_CONFIGURED', message: '本地预览尚未连接共享量子数据。可关闭量子开关，体验普通随机。' } }));
  });
  server.middlewares.use('/api/interpretations', (_req, res) => {
    res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ error: { code: 'AI_NOT_CONFIGURED', message: '本地预览尚未接通 AI 服务。问题和设置已保留，这次没有发起解读。' } }));
  });
}

export default defineConfig({
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  // Keep development optimization out of inherited tracked node_modules caches.
  cacheDir: path.resolve(import.meta.dirname, ".local/vite"),
  envDir: path.resolve(import.meta.dirname),
  plugins: [{ name: 'local-records-boundary', configureServer: localRecordsUnavailable, configurePreviewServer: localRecordsUnavailable }],
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: "127.0.0.1",
    port: 3000,
    strictPort: true,
    watch: { usePolling: true, interval: 350 },
  },
});
