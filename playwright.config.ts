import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  use: { baseURL: `http://localhost:${PORT}`, ...devices["Desktop Chrome"], viewport: { width: 1024, height: 768 } },
  webServer: {
    command: `pnpm exec next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { ITGO_DATA_DIR: ".data/e2e", ITGO_RESET_DB: "1" },
  },
});
