import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globalSetup: "./vitest.global-setup.ts",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/index.ts",
        "src/cli/program.ts",
        "src/cli/commands/log.ts",
        "src/cli/commands/list.ts",
        "src/git/history-resolver.ts",
        "src/git/file-tracker.ts",
        "src/types/context.ts",
        "src/types/document.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    testTimeout: 10000,
  },
});
