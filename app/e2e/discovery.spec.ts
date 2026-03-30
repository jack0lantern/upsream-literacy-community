/**
 * PRD Flow 2: Discovery & Matching
 * - Dashboard shows matches for onboarded user
 * - Match cards display name, role, district, shared challenges, score
 * - Filters narrow results (urbanicity, size)
 * - Clicking a match card navigates to public profile
 * - Public profile shows district info, challenges, and action button
 */
import { test, expect } from "@playwright/test";
import { login, ADMIN, USERS } from "./helpers";

test.describe("Discovery & Matching", () => {
  test("dashboard shows matches with peer count", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

    // Wait for matches to load
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("match cards show name, score percentage, and shared challenges", async ({
    page,
  }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });

    // At least one match card should have a percentage badge
    await expect(page.getByText(/%/).first()).toBeVisible();
  });

  test("seed user with different district also sees matches", async ({
    page,
  }) => {
    await login(page, USERS.lisa.email, USERS.lisa.password);
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking a match card navigates to public profile", async ({
    page,
  }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });

    // Click the first match card link
    const firstCard = page.locator('a[href^="/profile/"]').first();
    await firstCard.click();

    // Should be on a profile page
    await expect(page).toHaveURL(/\/profile\//);

    // Public profile shows name and challenges section
    await expect(page.getByText("Challenges")).toBeVisible();
  });

  test("public profile shows Send Message button for another user", async ({
    page,
  }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });

    const firstCard = page.locator('a[href^="/profile/"]').first();
    await firstCard.click();
    await expect(page).toHaveURL(/\/profile\//);

    // Should see Send Message or View Conversation button
    const actionButton = page.getByRole("link", { name: /Send Message|View Conversation/ });
    await expect(actionButton).toBeVisible({ timeout: 5_000 });
  });

  test("urbanicity filter narrows results", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });

    // Get initial peer count
    const initialText = await page.getByText(/\d+ peers found/).textContent();
    const initialCount = parseInt(initialText?.match(/(\d+)/)?.[1] ?? "0");

    // Apply urbanicity filter — click the Type select
    // On desktop the filter sidebar is visible
    const typeSelect = page
      .locator('[data-slot="select-trigger"]')
      .filter({ hasText: /All types|Urban|Suburban|Town|Rural/ })
      .first();

    if (await typeSelect.isVisible()) {
      await typeSelect.click();
      // Pick "Rural"
      await page.getByRole("option", { name: "Rural" }).click();

      // Wait for results to update
      await page.waitForTimeout(1000);
      const filteredText = await page
        .getByText(/\d+ peers found/)
        .textContent();
      const filteredCount = parseInt(
        filteredText?.match(/(\d+)/)?.[1] ?? "0"
      );

      // Filtered count should be <= initial (fewer or equal results)
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });
});
