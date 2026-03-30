/**
 * PRD Flow 4: Admin Moderation
 * - Admin can access /admin dashboard
 * - Admin overview shows platform stats cards
 * - Admin Users page shows user list
 * - Admin Flagged page renders
 * - Admin Keywords page allows adding keyword
 * - Admin Problems page shows problem statements with user counts
 * - Non-admin user is redirected away from /admin
 */
import { test, expect } from "@playwright/test";
import { login, ADMIN, USERS } from "./helpers";

test.describe("Admin Dashboard", () => {
  test("admin can access overview with stats", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin");

    await expect(page.getByText("Platform Overview")).toBeVisible({
      timeout: 5_000,
    });

    // Should show stat cards
    await expect(page.getByText("Total Users")).toBeVisible();
    await expect(page.getByText("Active (7-day)")).toBeVisible();
    await expect(page.getByText("Messages (7-day)")).toBeVisible();
  });

  test("admin Users page shows user table", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/users");

    // Should show search input
    await expect(
      page.getByPlaceholder("Search by name or email...")
    ).toBeVisible({ timeout: 5_000 });

    // Should show at least one user in the table
    await expect(page.locator("table tbody tr").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("admin can search users by name", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/users");

    await page.getByPlaceholder("Search by name or email...").fill("Maria");
    await page.waitForTimeout(500); // debounce

    // Should filter to show Maria
    await expect(page.getByText("Maria Santos").first()).toBeVisible({
      timeout: 5_000,
    });
  });

  test("admin Flagged page renders", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/flagged");

    // Should show heading
    await expect(page.getByText("Flagged Conversations")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("admin Keywords page allows adding a keyword", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/keywords");

    await expect(page.getByText("Keyword Alerts")).toBeVisible({
      timeout: 5_000,
    });

    // Add a keyword
    const keyword = `e2e_test_${Date.now()}`;
    await page.getByPlaceholder("Add keyword...").fill(keyword);
    await page.getByRole("button", { name: "Add" }).click();

    // Keyword should appear in the table
    await expect(page.getByText(keyword).first()).toBeVisible({
      timeout: 5_000,
    });

    // Clean up — remove it
    const row = page.locator("tr").filter({ hasText: keyword });
    await row.getByRole("button", { name: "Remove" }).click();

    // Should be gone
    await expect(page.getByText(keyword).first()).not.toBeVisible({
      timeout: 3_000,
    });
  });

  test("admin Problems page shows problem statements", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/admin/problems");

    await expect(page.getByText("Problem Statements")).toBeVisible({
      timeout: 5_000,
    });

    // Should show at least one problem statement category
    await expect(page.getByText("Curriculum & Instruction")).toBeVisible({
      timeout: 5_000,
    });

    // Should show user count badges
    await expect(page.getByText(/\d+ users/).first()).toBeVisible();
  });

  test("non-admin user is redirected away from /admin", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/admin");

    // Should be redirected to /dashboard (not on /admin)
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
  });
});
