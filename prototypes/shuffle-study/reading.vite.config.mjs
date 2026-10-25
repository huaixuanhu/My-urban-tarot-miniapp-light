import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import base from './vite.config.mjs';

export default defineConfig({
  ...base,
  // This local host can miss filesystem notifications across agent edits.
  server: { ...base.server, watch: { usePolling: true, interval: 350 } },
  build: { ...base.build, rollupOptions: { input: {
    shuffle: fileURLToPath(new URL('./index.html', import.meta.url)),
    reading: fileURLToPath(new URL('./reading.html', import.meta.url)),
  } } },
});
