import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@config": path.resolve(__dirname, "config"),
      "@content": path.resolve(__dirname, "content"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 20000, fileParallelism: false },
});
