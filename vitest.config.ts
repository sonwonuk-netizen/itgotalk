import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Server modules are imported directly in integration tests.
      "server-only": path.resolve(import.meta.dirname, "tests/unit/stubs/server-only.ts"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", "tests/unit/**/*.test.ts"],
    env: { ITGO_DATA_DIR: "memory" },
    testTimeout: 60_000,
  },
});
