import { type Page, expect } from "@playwright/test";

/**
 * Log in as a seeded user and wait for dashboard.
 */
export async function login(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
}

/** Admin seeded credentials */
export const ADMIN = { email: "admin@upstream.dev", password: "admin123" };

/** Seeded regular users (from seed.ts — all use password123) */
export const USERS = {
  maria: { email: "maria.santos@jefferson.edu", password: "password123", name: "Maria Santos" },
  james: { email: "james.oconnor@lausd.edu", password: "password123", name: "James O'Connor" },
  lisa: { email: "lisa.martinez@usd435.edu", password: "password123", name: "Lisa Martinez" },
  derek: { email: "derek.washington@springfield186.edu", password: "password123", name: "Derek Washington" },
  sarah: { email: "sarah.chen@dsisd.edu", password: "password123", name: "Sarah Chen" },
  priya: { email: "priya.patel@nycdoe.edu", password: "password123", name: "Priya Patel" },
  elena: { email: "elena.vega@samplecharter.edu", password: "password123", name: "Elena Vega" },
};

/**
 * Generate a unique email for signup tests (avoids collisions across runs).
 */
export function uniqueEmail(): string {
  return `e2e_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@test.com`;
}
