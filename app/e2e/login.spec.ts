import { test, expect } from "@playwright/test";

test("logs in with seeded admin credentials and reaches dashboard", async ({
  page,
}) => {
  await page.goto("/login");

  // Verify the login form is visible
  await expect(page.getByText("Welcome back")).toBeVisible();

  // Fill in the seeded admin credentials
  await page.getByLabel("Email").fill("admin@upstream.dev");
  await page.getByLabel("Password").fill("admin123");

  // Submit the form
  await page.getByRole("button", { name: "Sign in" }).click();

  // After login the app redirects to /dashboard (or /onboarding).
  // Wait for URL to leave /login.
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });

  // Confirm we landed on an authenticated page
  const url = page.url();
  expect(url).toMatch(/\/(dashboard|onboarding)/);
});

test("dashboard shows matches for a seeded user", async ({ page }) => {
  // Log in as a seed user who has a district and problems
  await page.goto("/login");
  await page.getByLabel("Email").fill("admin@upstream.dev");
  await page.getByLabel("Password").fill("admin123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Wait for matches to load — the subtitle shows "{N} peers found"
  await expect(
    page.getByText(/\d+ peers found/)
  ).toBeVisible({ timeout: 10_000 });
});

test("seed user with different district sees matches", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("lisa.martinez@usd435.edu");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  await expect(
    page.getByText(/\d+ peers found/)
  ).toBeVisible({ timeout: 10_000 });
});

test("signup page shows district search dropdown", async ({ page }) => {
  await page.goto("/signup");

  // Verify the district field exists
  await expect(page.getByLabel("District")).toBeVisible();

  // Type a search query and verify dropdown results appear
  await page.getByLabel("District").fill("Spring");
  await expect(
    page.getByText("Springfield SD 186").first()
  ).toBeVisible({ timeout: 5_000 });
});
