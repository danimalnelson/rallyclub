import { test, expect } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { encode } from "next-auth/jwt";

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const prisma = hasDatabaseUrl ? new PrismaClient() : undefined;

async function createTestUser(email: string) {
  if (!prisma) {
    throw new Error("DATABASE_URL must be set to run onboarding E2E tests");
  }

  return prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}

test.describe("Business onboarding flow", () => {
  test.skip(!hasDatabaseUrl, "DATABASE_URL env var missing - skipping onboarding e2e test");

  test.afterAll(async () => {
    await prisma?.$disconnect();
  });

  test("new business can complete onboarding", async ({ page }) => {
    const timestamp = Date.now();
    const email = `onboard-${timestamp}@example.com`;
    const user = await createTestUser(email);

    const secret = process.env.NEXTAUTH_SECRET || "test-secret";
    const sessionToken = await encode({
      token: {
        email,
        name: "Onboarding Tester",
        sub: user.id,
      },
      secret,
    });

    await page.context().addCookies([
      {
        name: "next-auth.session-token",
        value: sessionToken,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);

    await page.goto("/app");
    await page.waitForURL(/\/onboarding\/details/);

    const slug = `playwright-${timestamp}`;

    await page.getByLabel("Business Name *").fill("Playwright Winery");
    await page.getByLabel("URL Slug *").fill(slug);
    await page.getByLabel("Country *").selectOption("US");
    await page.getByLabel("Currency *").selectOption("USD");

    await page.getByRole("button", { name: "Continue" }).click();
    await page.waitForURL(/\/onboarding\/connect/);

    const currentUrl = new URL(page.url());
    const businessId = currentUrl.searchParams.get("businessId");
    expect(businessId).not.toBeNull();

    await page.getByRole("button", { name: "Connect with Stripe" }).click();
    await page.waitForURL(/\/onboarding\/success/);

    const createdBusiness = await prisma?.business.findUnique({ where: { id: businessId! } });
    expect(createdBusiness?.status).toBe("ONBOARDING_PENDING");

    await page.request.post("/api/test/stripe/mock-account-update", {
      data: {
        businessId,
        status: "ONBOARDING_COMPLETE",
        contactEmail: "support@playwrightwinery.test",
      },
    });

    await expect(page.getByRole("button", { name: /Go to Dashboard/ })).toBeEnabled({ timeout: 10000 });

    await page.getByRole("button", { name: /Go to Dashboard/ }).click();
    await page.waitForURL(new RegExp(`/app/${businessId}`));
    await expect(page.getByText("Wine Club Dashboard")).toBeVisible();

    await prisma?.businessUser.deleteMany({ where: { userId: user.id } });
    await prisma?.business.delete({ where: { id: businessId! } });
    await prisma?.user.delete({ where: { id: user.id } });
  });
});
