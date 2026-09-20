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
  build: { target: "chrome120" },
  test: { include: ["src/**/*.test.ts"], environment: "node" },
});
