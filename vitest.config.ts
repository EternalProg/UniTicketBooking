import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    testTimeout: 30000,
    fileParallelism: false,
    pool: "forks",
    sequence: { concurrent: false },
    exclude: ["src/__tests__/integration/**"],
    coverage: {
      provider: "v8",
      include: [
        "src/modules/**",
        "src/middleware/**",
        "src/plugins/**",
        "src/lib/jwt.ts",
        "src/lib/logger.ts",
        "src/lib/prisma.ts",
        "src/lib/schema-helper.ts",
        "src/app.ts",
      ],
      exclude: ["src/**/*.test.ts", "src/__tests__/**"],
      reporter: ["text", "lcov", "html"],
      reportsDirectory: "./coverage",
    },
  },
});
