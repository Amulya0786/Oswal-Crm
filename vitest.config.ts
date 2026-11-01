import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    maxWorkers: 1,
    hookTimeout: 120000,
    testTimeout: 120000,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
