import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    // Integration tests chdir into temp repos, which needs child processes
    pool: "forks",
    testTimeout: 30_000,
  },
});
