import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["**/node_modules/**", "**/e2e/**", "**/*.spec.ts"],
    include: ["**/*.test.ts"],
    env: Object.fromEntries(
      Object.entries({
        // Test environment variables - must be set in CI/CD or local .env file
        DATABASE_URL: process.env.DATABASE_URL,
        NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
        NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
        STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
        STRIPE_PUBLISHABLE_KEY: process.env.STRIPE_PUBLISHABLE_KEY,
        STRIPE_CONNECT_CLIENT_ID: process.env.STRIPE_CONNECT_CLIENT_ID,
        RESEND_API_KEY: process.env.RESEND_API_KEY,
        PUBLIC_APP_URL: process.env.PUBLIC_APP_URL || "http://localhost:3000",
      }).filter(([_, value]) => value !== undefined)
    ) as Record<string, string>,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

