/**
 * PRD Flow 1 (continued): Profile Management
 * - View own profile (name, role, district, bio, challenges)
 * - Edit bio and challenges
 * - Profile shows Blocked people section
 * - Account deactivation dialog renders
 */
import { test, expect } from "@playwright/test";
import { login, USERS } from "./helpers";

test.describe("Profile", () => {
  test("own profile page shows user info and challenges", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/profile");

    // Should show the user's name
    await expect(page.getByText(USERS.maria.name)).toBeVisible({
      timeout: 5_000,
    });

    // Should show the About section
    await expect(page.getByText("About")).toBeVisible();

    // Should show challenges section with badges
    await expect(page.getByText("Challenges")).toBeVisible();
  });

  test("edit button opens editing mode with bio textarea", async ({
    page,
  }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/profile");

    // Wait for profile to load
    await expect(page.getByText(USERS.maria.name)).toBeVisible({
      timeout: 5_000,
    });

    // Click Edit button
    await page.getByRole("button", { name: "Edit" }).click();

    // Should show bio textarea and save/cancel buttons
    await expect(
      page.getByPlaceholder(
        "What literacy challenge are you most focused on right now?"
      )
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save changes" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Cancel" })
    ).toBeVisible();
  });

  test("cancel editing returns to view mode", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/profile");
    await expect(page.getByText(USERS.maria.name)).toBeVisible({
      timeout: 5_000,
    });

    await page.getByRole("button", { name: "Edit" }).click();
    await expect(
      page.getByRole("button", { name: "Save changes" })
    ).toBeVisible();

    await page.getByRole("button", { name: "Cancel" }).click();

    // Should be back in view mode — Edit button visible again
    await expect(page.getByRole("button", { name: "Edit" })).toBeVisible();
  });

  test("profile shows Blocked people section", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/profile");

    await expect(page.getByText("Blocked people")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("profile shows Account section with deactivation button", async ({
    page,
  }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/profile");

    await expect(page.getByText("Account", { exact: true })).toBeVisible({ timeout: 5_000 });
    await expect(
      page.getByRole("button", { name: "Deactivate account" })
    ).toBeVisible();
  });

  test("deactivation button opens confirmation dialog", async ({ page }) => {
    await login(page, USERS.maria.email, USERS.maria.password);
    await page.goto("/profile");
    await expect(page.getByText("Account", { exact: true })).toBeVisible({ timeout: 5_000 });

    await page.getByRole("button", { name: "Deactivate account" }).click();

    // Dialog should appear
    await expect(page.getByText("Deactivate your account?")).toBeVisible({
      timeout: 3_000,
    });
  });
});
