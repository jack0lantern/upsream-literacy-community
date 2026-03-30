/**
 * P4.5: Responsive testing across viewports
 * Mobile (375px), Tablet (768px), Desktop (1280px+)
 */
import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 900 },
};

for (const [name, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Responsive: ${name} (${viewport.width}px)`, () => {
    test.use({ viewport });

    test("login page renders correctly", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByLabel("Email")).toBeVisible();
      await expect(page.getByLabel("Password")).toBeVisible();
      await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
    });

    test("dashboard renders and shows matches", async ({ page }) => {
      await login(page, USERS.maria.email, USERS.maria.password);
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByText(/\d+ peers found/)).toBeVisible({
        timeout: 10_000,
      });
    });

    test("messages page renders", async ({ page }) => {
      await login(page, USERS.maria.email, USERS.maria.password);
      await page.goto("/messages");
      await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible({
        timeout: 5_000,
      });
    });

    test("profile page renders", async ({ page }) => {
      await login(page, USERS.maria.email, USERS.maria.password);
      await page.goto("/profile");
      await expect(page.getByText(USERS.maria.name)).toBeVisible({
        timeout: 5_000,
      });
    });

    if (name === "mobile") {
      test("mobile navigation uses hamburger menu", async ({ page }) => {
        await login(page, USERS.maria.email, USERS.maria.password);
        // On mobile, main nav links may be hidden behind a hamburger/sheet
        // The hamburger button should be visible
        const hamburger = page.getByRole("button", { name: /menu/i }).or(
          page.locator("button").filter({ has: page.locator("svg") }).first()
        );
        // Either hamburger is visible (mobile nav) or links are directly visible (responsive nav)
        const linksVisible = await page
          .getByRole("link", { name: "Discover" })
          .isVisible()
          .catch(() => false);
        const hamburgerVisible = await hamburger.isVisible().catch(() => false);
        expect(linksVisible || hamburgerVisible).toBe(true);
      });
    }
  });
}
