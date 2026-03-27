import { vi } from "vitest";

// Mock environment variables
process.env.AUTH_SECRET = "test-secret-at-least-32-chars-long-for-tests";
process.env.AUTH_URL = "http://localhost:3000";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
process.env.RESEND_API_KEY = "re_test_key";
process.env.DATABASE_URL = "postgresql://localhost:5432/test";

// Mock Resend email sending globally
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  sendMessageNotificationEmail: vi.fn().mockResolvedValue(undefined),
}));
