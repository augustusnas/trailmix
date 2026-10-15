import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    ...devices["iPhone 14"], // Safari's engine (WebKit) at 390×844
    baseURL: `http://localhost:${PORT}`,
    serviceWorkers: "block", // the offline test switches this back on
    trace: "retain-on-failure",
  },
  projects: [{ name: "iphone-webkit", use: { browserName: "webkit" } }],
  webServer: {
    // Tests run against the production build. FEEDBACK_EMAIL is deliberately unset.
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/home`,
    reuseExistingServer: !process.env.CI,
    env: { FEEDBACK_EMAIL: "" },
  },
});
