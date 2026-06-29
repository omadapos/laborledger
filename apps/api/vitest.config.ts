import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Nest integration specs boot the app, run argon2, and hit Postgres. The Vitest
    // default 5s limit flakes on Windows when the full suite runs serially (~150s+).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    maxWorkers: 1,
    fileParallelism: false,
    sequence: {
      concurrent: false
    }
  }
});
