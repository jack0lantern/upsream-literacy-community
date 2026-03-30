/**
 * PRD Flow 1 (partial): Authentication
 * - Login with valid credentials → dashboard
 * - Login with invalid credentials → error
 * - Signup → auto-login → onboarding redirect
 * - Forgot password page renders
 */
import { test, expect } from "@playwright/test";
import { login, ADMIN, USERS, uniqueEmail } from "./helpers";

test.describe("Authentication", () => {
  test("logs in with seeded admin credentials and reaches dashboard", async ({
    page,
  }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)/);
  });

  test("logs in with seeded regular user", async ({ page }) => {
    await login(page, USERS.lisa.email, USERS.lisa.password);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email").fill("nobody@test.com");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("alert")).toBeVisible({ timeout: 5_000 });
    // Should stay on login
    await expect(page).toHaveURL(/\/login/);
  });

  test("signup creates account and redirects to onboarding", async ({
    page,
  }) => {
    const email = uniqueEmail();

    await page.goto("/signup");
    await expect(page.getByText("Create your account")).toBeVisible();

    await page.getByLabel("Full name").fill("E2E Test User");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("testpassword123");
    await page.getByRole("button", { name: "Create account" }).click();

    // Should redirect to onboarding after auto-login
    await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });

  test("signup page shows district search dropdown", async ({ page }) => {
    await page.goto("/signup");
    await expect(page.getByLabel("District")).toBeVisible();

    await page.getByLabel("District").fill("Spring");
    await expect(
      page.getByText("Springfield SD 186").first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test("forgot password page renders", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByText("Reset your password")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
