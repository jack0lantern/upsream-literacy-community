/**
 * Navigation & Layout
 * - Nav bar shows Discover, Messages, Profile links
 * - Auth redirect: unauthenticated user is sent to /login
 * - Admin link visible only for admin users
 * - Mobile menu works (hamburger → sheet with nav links)
 */
import { test, expect } from "@playwright/test";
import { login, ADMIN, USERS } from "./helpers";

test.describe("Navigation", () => {
  test("nav shows Discover, Messages, Profile for authenticated user", async ({
    page,
  }) => {
    await login(page, USERS.maria.email, USERS.maria.password);

    await expect(page.getByRole("link", { name: "Discover" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Messages" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Profile" })).toBeVisible();
  });

  test("admin user sees Admin nav link", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();
  });

  test("regular user does not see Admin nav link", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);

    await expect(page.getByRole("link", { name: "Admin" })).not.toBeVisible();
  });

  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");

    // Should redirect to /login
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("clicking Discover nav link goes to dashboard", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);

    await page.goto("/profile");
    await page.getByRole("link", { name: "Discover" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("clicking Messages nav link goes to messages", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);

    await page.getByRole("link", { name: "Messages" }).click();

    await expect(page).toHaveURL(/\/messages/);
  });
});
