import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      include: ["src/**/*.ts"],
      exclude: [
        "src/cli/index.ts",
        "src/cli/program.ts",
        "src/cli/commands/diff.ts",
        "src/cli/commands/graph.ts",
        "src/cli/commands/list-versions.ts",
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
