import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // the app as beta users get it: BETA_RESET_PAGE off
const RESET_ON_PORT = 3101; // the same build with BETA_RESET_PAGE=on, for the reset page tests

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
  projects: [
    { name: "iphone-webkit", use: { browserName: "webkit" }, testIgnore: /reset-on\.spec\.ts/ },
    {
      name: "reset-page-on",
      use: { browserName: "webkit", baseURL: `http://localhost:${RESET_ON_PORT}` },
      testMatch: /reset-on\.spec\.ts/,
    },
  ],
  // Tests run against the production build. FEEDBACK_EMAIL is deliberately unset.
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/home`,
      reuseExistingServer: !process.env.CI,
      env: { FEEDBACK_EMAIL: "", BETA_RESET_PAGE: "" },
    },
    {
      command: `npx next start -p ${RESET_ON_PORT}`,
      url: `http://localhost:${RESET_ON_PORT}/home`,
      reuseExistingServer: !process.env.CI,
      env: { FEEDBACK_EMAIL: "", BETA_RESET_PAGE: "on" },
    },
  ],
});
