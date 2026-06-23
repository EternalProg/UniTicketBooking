import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
    sequence: { concurrent: false },
    coverage: {
      provider: "v8",
      include: ["src/middleware/**/*.ts"],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
