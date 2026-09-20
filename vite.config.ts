import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    watch: { ignored: ["**/.cache/**", "**/test-results/**", "**/release/**"] },
  },
  build: {
    target: "chrome120",
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("index.html", import.meta.url)),
        popup: fileURLToPath(new URL("popup.html", import.meta.url)),
      },
    },
  },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
