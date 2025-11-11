import { defineConfig, devices } from "@playwright/test";

// Load environment variables for tests - must be set in CI/CD or local .env file
// For local development, copy ENV_VARIABLES_FOR_VERCEL.txt values to .env.local

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    env: Object.fromEntries(
      Object.entries({
        DATABASE_URL: process.env.DATABASE_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
        STRIPE_CONNECT_CLIENT_ID: process.env.STRIPE_CONNECT_CLIENT_ID,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
      }).filter(([_, value]) => value !== undefined)
    ) as Record<string, string>,
  },
});

