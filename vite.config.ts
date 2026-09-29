import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig(({ command }) => ({
  publicDir: command === "serve" ? "public" : false,
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks: { three: ["three"] } } } },
}));
