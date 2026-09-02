import { createRequire } from "node:module";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const require = createRequire(import.meta.url);
const { version } = require("./package.json") as { version: string };

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    // Single source of truth: the version lives only in package.json.
    __APP_VERSION__: JSON.stringify(version)
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared")
    }
  },
  server: {
    port: 5173,
    strictPort: true
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500
  }
});
