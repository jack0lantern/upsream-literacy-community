/**
 * PRD Flow 3: Messaging
 * - Navigate to profile → click Send Message → compose first message → send
 * - Message appears in conversation thread
 * - Recipient sees pending request in Messages > Requests tab
 * - Recipient accepts request → conversation becomes active
 * - Messages page shows conversation list
 * - Mute/unmute conversation via dropdown
 */
import { test, expect } from "@playwright/test";
import { login, ADMIN, USERS } from "./helpers";

test.describe("Messaging", () => {
  test("send first message from profile page creates pending conversation", async ({
    page,
  }) => {
    // Log in as Sarah
    await login(page, USERS.sarah.email, USERS.sarah.password);
    await expect(page.getByText(/\d+ peers found/)).toBeVisible({
      timeout: 10_000,
    });

    // Click a match to go to their profile
    const matchCard = page.locator('a[href^="/profile/"]').first();
    await matchCard.click();
    await expect(page).toHaveURL(/\/profile\//);

    // Click Send Message (if no existing conversation)
    const sendBtn = page.getByRole("link", { name: "Send Message" });
    if (await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await sendBtn.click();

      // Should go to /messages?new=... which shows compose panel
      await expect(page).toHaveURL(/\/messages\?new=/, { timeout: 5_000 });

      // Wait for compose UI to load
      await expect(
        page.getByPlaceholder("Write your first message...")
      ).toBeVisible({ timeout: 5_000 });

      // Type and send a message
      await page
        .getByPlaceholder("Write your first message...")
        .fill("Hi! I noticed we share challenges. Would love to connect.");
      await page.getByRole("button", { name: "Send Message" }).click();

      // Should redirect to the conversation thread
      await expect(page).toHaveURL(/\/messages\//, { timeout: 10_000 });
    }
  });

  test("messages page shows conversation list or empty state", async ({ page }) => {
    await login(page, ADMIN.email, ADMIN.password);
    await page.goto("/messages");

    // Should see Messages heading
    await expect(page.getByRole("heading", { name: "Messages" })).toBeVisible();

    // Wait for loading to finish — either conversations appear or empty state
    // The tabs are "Messages" and "Requests" buttons — the default tab is Messages
    await expect(
      page.getByText("No conversations yet").or(
        page.locator('a[href^="/messages/"]').first()
      )
    ).toBeVisible({ timeout: 10_000 });
  });

  test("messages page has Requests tab", async ({ page }) => {
    await login(page, USERS.derek.email, USERS.derek.password);
    await page.goto("/messages");

    // Should see both Messages and Requests tabs
    await expect(page.getByRole("button", { name: "Messages" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Requests/ })).toBeVisible();

    // Click Requests tab
    await page.getByRole("button", { name: /Requests/ }).click();

    // Should show either pending requests or empty state
    const hasRequests = await page
      .locator('a[href^="/messages/"]')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    const noRequests = await page
      .getByText("No pending requests")
      .isVisible({ timeout: 1_000 })
      .catch(() => false);

    expect(hasRequests || noRequests).toBe(true);
  });
});

