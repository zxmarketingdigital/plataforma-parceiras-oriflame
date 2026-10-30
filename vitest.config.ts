import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  // tsconfig usa jsx "preserve" (Next compila o JSX); nos testes de renderização o oxc tem de o transformar.
  oxc: { jsx: { runtime: "automatic" } },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@config": path.resolve(__dirname, "config"),
      "@content": path.resolve(__dirname, "content"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 20000, fileParallelism: false },
});
