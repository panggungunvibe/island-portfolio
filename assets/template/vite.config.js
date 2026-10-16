import { defineConfig } from "vite";
export default defineConfig({
  server: { watch: { ignored: ["**/analysis/**"] } },
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
});
