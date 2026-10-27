import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "client"),
  base: "./",
  // Keep development optimization out of inherited tracked node_modules caches.
  cacheDir: path.resolve(import.meta.dirname, ".local/vite"),
  envDir: path.resolve(import.meta.dirname),
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
