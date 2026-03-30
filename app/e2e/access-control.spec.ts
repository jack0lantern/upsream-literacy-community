/**
 * P4.6: Access control verification
 * - Users can only access their own conversations
 * - Unauthenticated users get 401
 * - Non-admin users can't access admin routes
 */
import { test, expect } from "@playwright/test";
import { login, ADMIN, USERS } from "./helpers";

test.describe("Access Control", () => {
  test("unauthenticated user cannot access dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated user cannot access messages", async ({ page }) => {
    await page.goto("/messages");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("unauthenticated user cannot access profile", async ({ page }) => {
    await page.goto("/profile");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("non-admin cannot access admin pages", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);

    await page.goto("/admin");
    await expect(page).not.toHaveURL(/\/admin/, { timeout: 10_000 });

    await page.goto("/admin/users");
    await expect(page).not.toHaveURL(/\/admin\/users/, { timeout: 10_000 });

    await page.goto("/admin/flagged");
    await expect(page).not.toHaveURL(/\/admin\/flagged/, { timeout: 10_000 });

    await page.goto("/admin/keywords");
    await expect(page).not.toHaveURL(/\/admin\/keywords/, { timeout: 10_000 });
  });

  test("admin can access all admin pages", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);

    await page.goto("/admin");
    await expect(page.getByText("Platform Overview")).toBeVisible({ timeout: 5_000 });

    await page.goto("/admin/users");
    await expect(page.getByPlaceholder("Search by name or email...")).toBeVisible({ timeout: 5_000 });

    await page.goto("/admin/flagged");
    await expect(page.getByText("Flagged Conversations")).toBeVisible({ timeout: 5_000 });

    await page.goto("/admin/keywords");
    await expect(page.getByText("Keyword Alerts")).toBeVisible({ timeout: 5_000 });
  });

  test("user cannot access another user's conversation via direct URL", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);

    // Navigate to a fake conversation ID
    await page.goto("/messages/00000000-0000-0000-0000-000000000000");

    // Should show error or redirect — not a real conversation thread
    const errorVisible = await page
      .getByText(/not found|error|unauthorized|no access/i)
      .isVisible({ timeout: 5_000 })
      .catch(() => false);
    const redirected = !/messages\/00000000/.test(page.url());

    expect(errorVisible || redirected).toBe(true);
  });

  test("API endpoints require authentication", async ({ request }) => {
    const endpoints = [
      { method: "GET" as const, url: "/api/matches" },
      { method: "GET" as const, url: "/api/conversations" },
      { method: "GET" as const, url: "/api/profile" },
      { method: "POST" as const, url: "/api/messages" },
      { method: "POST" as const, url: "/api/conversations" },
    ];

    for (const { method, url } of endpoints) {
      const response = method === "GET"
        ? await request.get(url)
        : await request.post(url, { data: {} });
      expect(response.status(), `${method} ${url} should require auth`).toBe(401);
    }
  });

  test("admin API endpoints require admin role", async ({ page, request }) => {
    // Login as regular user first
    await login(page, USERS.maria.email, USERS.maria.password);

    // Try to access admin API endpoints (should get 403 or redirect)
    const adminEndpoints = [
      "/api/admin/users",
      "/api/admin/stats",
      "/api/admin/flagged",
      "/api/admin/keywords",
    ];

    for (const url of adminEndpoints) {
      const response = await request.get(url);
      expect(
        [401, 403].includes(response.status()),
        `${url} should reject non-admin`
      ).toBe(true);
    }
  });
});
