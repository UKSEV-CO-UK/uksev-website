import { defineConfig } from "@playwright/test";

const ci = !!process.env.CI;
const port = ci ? 4173 : 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: ci ? `npx --yes serve out -p ${port}` : "npm run dev -- --port 3000",
    url: `http://localhost:${port}`,
    reuseExistingServer: !ci,
    timeout: 120_000,
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1280, height: 800 } } },
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        isMobile: true,
      },
    },
  ],
});
