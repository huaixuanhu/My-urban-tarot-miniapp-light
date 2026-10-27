// Compatibility for existing local bookmarks; the sole UI now lives in client/.
import { defineConfig } from 'vite';
import application from '../../vite.config.ts';
export default defineConfig({
  ...application,
  server: { ...application.server, port: 5174, strictPort: true },
});
