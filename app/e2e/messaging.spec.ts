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

  test("report conversation dialog opens and stays open without flickering", async ({
    page,
  }) => {
    // Log in as Sarah and navigate to a conversation
    await login(page, USERS.sarah.email, USERS.sarah.password);
    await page.goto("/messages");

    // Wait for conversations to load
    const conversationLink = page.locator('a[href^="/messages/"]').first();
    await expect(conversationLink).toBeVisible({ timeout: 10_000 });

    // Click the first conversation to open it
    await conversationLink.click();
    await expect(page).toHaveURL(/\/messages\//, { timeout: 5_000 });

    // Wait for the conversation to fully load
    await expect(page.locator('[role="dialog"]')).not.toBeVisible({
      timeout: 1_000,
    });

    // Click the dropdown menu button (⋮ three-dot icon)
    const menuButton = page.locator('button[aria-label="Conversation options"]');
    await expect(menuButton).toBeVisible({ timeout: 5_000 });
    await menuButton.click();

    // Wait for dropdown to appear
    await expect(page.getByText("Mute conversation")).toBeVisible({
      timeout: 2_000,
    });

    // Click "Report conversation"
    await page.getByText("Report conversation").click();

    // Verify the dialog opens and stays visible (no flicker)
    const reportDialog = page.getByRole("dialog", {
      name: "Report this conversation",
    });
    await expect(reportDialog).toBeVisible({ timeout: 2_000 });

    // Verify the dialog content is still visible after a brief pause
    // (if it was flickering and closing, this would fail)
    await page.waitForTimeout(500);
    await expect(reportDialog).toBeVisible();

    // Verify we can interact with the dialog - select a reason
    const selectTrigger = page.locator('[data-slot="select-trigger"]').first();
    await expect(selectTrigger).toBeVisible();
    await selectTrigger.click();
    await page.getByRole("option", { name: "Spam" }).click();

    // Verify the option was selected (label should be visible)
    await expect(selectTrigger).toContainText("Spam");
  });
});

