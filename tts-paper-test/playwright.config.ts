import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: [["html", { outputFolder: "e2e-report" }], ["list"]],
  use: {
    baseURL: "http://localhost:5173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "cd frontend && npx vite --port 5173",
      port: 5173,
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "cd backend && source .venv/bin/activate && python main.py",
      port: 8000,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
})
