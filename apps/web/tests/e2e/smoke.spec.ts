import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("homepage loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Wine Club SaaS")).toBeVisible();
  });

  test("sample business page loads", async ({ page }) => {
    await page.goto("/rubytap");
    await expect(page.getByText("Ruby Tap")).toBeVisible();
    await expect(page.getByText("Join Our Wine Club")).toBeVisible();
  });

  test("sign in page loads", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByText("Sign In")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in with email/i })).toBeVisible();
  });

  test("plan listing shows on business page", async ({ page }) => {
    await page.goto("/rubytap");
    
    // Should show plan cards
    await expect(page.getByText("Premium Wine Club")).toBeVisible();
    await expect(page.getByText("Classic Wine Club")).toBeVisible();
  });

  test("clicking plan navigates to detail page", async ({ page }) => {
    await page.goto("/rubytap");
    
    // Click on first "View Details" button
    await page.getByRole("button", { name: "View Details" }).first().click();
    
    // Should be on plan detail page
    await expect(page.getByText("Choose Your Plan")).toBeVisible();
    await expect(page.getByRole("button", { name: "Join Now" })).toBeVisible();
  });

  test("member portal page loads", async ({ page }) => {
    await page.goto("/rubytap/portal");
    await expect(page.getByText("Member Portal")).toBeVisible();
    await expect(page.getByPlaceholder("you@example.com")).toBeVisible();
  });

  test("dashboard requires auth", async ({ page }) => {
    await page.goto("/app");
    
    // Should redirect to sign in
    await page.waitForURL(/\/auth\/signin/);
    await expect(page.getByText("Sign In")).toBeVisible();
  });
});

