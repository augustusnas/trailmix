import { defineConfig, devices } from "@playwright/test";

const PORT = 3100; // the app as beta users get it: SHOW_RESET_PAGE off
const RESET_ON_PORT = 3101; // the same build with SHOW_RESET_PAGE=true and the real limits, for reset and limit tests

// Recorded answers instead of Claude, iTunes, Odesli, YouTube and Upstash: tests cost nothing and
// never touch real accounts. The keys are fake on purpose (the secret scan checks none reach the browser).
const TEST_ENV = {
  FEEDBACK_EMAIL: "",
  FAKE_SERVICES: "1",
  BETA_ACCESS_CODE: "test-trail-code",
  ANTHROPIC_API_KEY: "sk-ant-test-NOT-A-REAL-KEY-ff00",
  YOUTUBE_API_KEY: "AIza-test-NOT-A-REAL-KEY-ee11",
  MIXES_PAUSED: "",
  DAILY_MIX_CEILING: "",
};

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
    { name: "iphone-webkit", use: { browserName: "webkit" }, testIgnore: /(reset-on|limits)\.spec\.ts/ },
    {
      name: "reset-page-on",
      use: { browserName: "webkit", baseURL: `http://localhost:${RESET_ON_PORT}` },
      testMatch: /(reset-on|limits)\.spec\.ts/,
    },
  ],
  // Tests run against the production build. FEEDBACK_EMAIL is deliberately unset.
  webServer: [
    {
      command: `npx next start -p ${PORT}`,
      url: `http://localhost:${PORT}/home`,
      reuseExistingServer: !process.env.CI,
      env: { ...TEST_ENV, SHOW_RESET_PAGE: "", TEST_RELAXED_LIMITS: "1" },
    },
    {
      command: `npx next start -p ${RESET_ON_PORT}`,
      url: `http://localhost:${RESET_ON_PORT}/home`,
      reuseExistingServer: !process.env.CI,
      env: { ...TEST_ENV, SHOW_RESET_PAGE: "true" },
    },
  ],
});
