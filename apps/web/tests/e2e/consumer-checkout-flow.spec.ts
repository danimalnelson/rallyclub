import { test, expect } from "@playwright/test";

test.describe("Consumer Checkout Flow", () => {
  const testSlug = "test-business";
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  test("should display public plans page", async ({ page }) => {
    // Navigate to public landing page
    await page.goto(`${baseUrl}/${testSlug}`);

    // Should show business name in header
    await expect(page.locator("h1").first()).toBeVisible();

    // Should have a "Member Portal" button
    await expect(page.getByRole("button", { name: /member portal/i })).toBeVisible();

    // Should show plans or a message if no plans available
    const plansOrMessage = page.locator("text=/Subscribe Now|No membership plans available/i").first();
    await expect(plansOrMessage).toBeVisible();
  });

  test("should navigate to plan details", async ({ page }) => {
    await page.goto(`${baseUrl}/${testSlug}`);

    // If there are plans, try clicking on one
    const subscribeButton = page.getByRole("button", { name: /subscribe now/i }).first();
    const buttonCount = await subscribeButton.count();

    if (buttonCount > 0 && await subscribeButton.isVisible()) {
      await subscribeButton.click();

      // Should navigate to plan details or checkout
      await expect(page).toHaveURL(new RegExp(`/${testSlug}/plans/[^/]+`));
    }
  });

  test("should show checkout form", async ({ page }) => {
    await page.goto(`${baseUrl}/${testSlug}`);

    const subscribeButton = page.getByRole("button", { name: /subscribe now/i }).first();
    const buttonCount = await subscribeButton.count();

    if (buttonCount > 0 && await subscribeButton.isVisible()) {
      await subscribeButton.click();

      // Wait for navigation
      await page.waitForURL(new RegExp(`/${testSlug}/plans/[^/]+`));

      // Click "Subscribe Now" on details page
      const detailsSubscribeButton = page.getByRole("link", { name: /subscribe now/i }).first();
      if (await detailsSubscribeButton.isVisible()) {
        await detailsSubscribeButton.click();

        // Should show email input on checkout page
        await expect(page.getByPlaceholder(/email/i)).toBeVisible();
        await expect(page.getByRole("button", { name: /continue to checkout/i })).toBeVisible();
      }
    }
  });

  test("should validate email on checkout", async ({ page }) => {
    // Direct navigation to a hypothetical checkout page
    // This test assumes you have at least one plan with a known ID
    // In real testing, you'd seed the database with test data
    const testPlanId = "test-plan-id";
    await page.goto(`${baseUrl}/${testSlug}/plans/${testPlanId}/checkout`);

    const emailInput = page.getByPlaceholder(/email/i);
    const submitButton = page.getByRole("button", { name: /continue to checkout/i });

    // Should be disabled without email
    await expect(submitButton).toBeDisabled();

    // Should enable after entering email
    await emailInput.fill("test@example.com");
    await expect(submitButton).toBeEnabled();
  });

  test("should navigate to member portal", async ({ page }) => {
    await page.goto(`${baseUrl}/${testSlug}`);

    // Click "Member Portal" button
    const portalButton = page.getByRole("button", { name: /member portal/i });
    await portalButton.click();

    // Should redirect to signin (if not authenticated) or portal
    await expect(page).toHaveURL(new RegExp(`/${testSlug}/(auth/signin|portal)`));
  });

  test("should show signin page for portal", async ({ page }) => {
    await page.goto(`${baseUrl}/${testSlug}/portal`);

    // Should redirect to signin page
    await page.waitForURL(new RegExp(`/${testSlug}/auth/signin`));

    // Should show email input
    await expect(page.getByPlaceholder(/email/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /send magic link/i })).toBeVisible();
  });

  test("should show success page after checkout", async ({ page }) => {
    // Direct navigation to success page
    await page.goto(`${baseUrl}/${testSlug}/success?session_id=test_session`);

    // Should show success message
    await expect(page.getByText(/welcome to/i)).toBeVisible();
    await expect(page.getByText(/subscription has been successfully created/i)).toBeVisible();

    // Should have button to go to portal
    await expect(page.getByRole("link", { name: /member portal/i })).toBeVisible();
  });

  test("should show cancel page", async ({ page }) => {
    await page.goto(`${baseUrl}/${testSlug}/cancel`);

    // Should show cancellation message
    await expect(page.getByText(/checkout cancelled/i)).toBeVisible();
    await expect(page.getByText(/no charges were made/i)).toBeVisible();

    // Should have button to browse plans
    await expect(page.getByRole("link", { name: /browse plans/i })).toBeVisible();
  });
});

test.describe("Member Portal (Authenticated)", () => {
  const testSlug = "test-business";
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";

  // Note: These tests require authentication setup
  // In a real test environment, you'd set up a test consumer session cookie

  test.skip("should display subscriptions in portal", async ({ page, context }) => {
    // Set up test consumer session
    // await context.addCookies([{
    //   name: "consumer_session",
    //   value: "test_session_token",
    //   domain: "localhost",
    //   path: "/"
    // }]);

    await page.goto(`${baseUrl}/${testSlug}/portal`);

    // Should show portal header
    await expect(page.getByText(/member portal/i)).toBeVisible();

    // Should show subscriptions or "no subscriptions" message
    const subsOrMessage = page.locator("text=/your subscriptions|no active subscriptions/i").first();
    await expect(subsOrMessage).toBeVisible();
  });

  test.skip("should open Stripe Customer Portal", async ({ page, context }) => {
    // Set up test consumer session
    await page.goto(`${baseUrl}/${testSlug}/portal`);

    // Should have button to open Stripe portal
    const stripePortalButton = page.getByRole("button", { name: /open stripe customer portal/i });
    await expect(stripePortalButton).toBeVisible();
  });
});

