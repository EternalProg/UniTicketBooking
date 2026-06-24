import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
    sequence: { concurrent: false },
    dir: "src/__tests__/integration",
    setupFiles: ["./src/__tests__/integration/load-test-env.ts"],
  },
});
