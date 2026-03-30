/**
 * P5.4: Input validation pass
 * Verify Zod schemas and sanitization enforce limits
 */
import { describe, it, expect } from "vitest";
import { z } from "zod/v4";
import { sanitizeMessageBody } from "@/lib/sanitize";

// Reproduce the schemas from API routes to test them
const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  districtId: z.string().optional(),
});

const onboardingSchema = z.object({
  districtId: z.string().min(1),
  role: z.enum(["literacy_director", "curriculum_coordinator", "literacy_coach", "mtss_coordinator", "other"]),
  problemIds: z.array(z.string()).min(1).max(5),
  bio: z.string().max(280).optional(),
});

const messageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

describe("Input Validation", () => {
  describe("Signup schema", () => {
    it("accepts valid signup data", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        password: "password123",
        name: "Test User",
      });
      expect(result.success).toBe(true);
    });

    it("rejects invalid email", () => {
      const result = signupSchema.safeParse({
        email: "not-an-email",
        password: "password123",
        name: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects short password (< 8 chars)", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        password: "short",
        name: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects long password (> 128 chars)", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        password: "a".repeat(129),
        name: "Test",
      });
      expect(result.success).toBe(false);
    });

    it("rejects empty name", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        password: "password123",
        name: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects long name (> 100 chars)", () => {
      const result = signupSchema.safeParse({
        email: "test@example.com",
        password: "password123",
        name: "a".repeat(101),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Onboarding schema", () => {
    it("accepts valid onboarding data", () => {
      const result = onboardingSchema.safeParse({
        districtId: "dist-1",
        role: "literacy_director",
        problemIds: ["p1", "p2"],
        bio: "I lead literacy initiatives.",
      });
      expect(result.success).toBe(true);
    });

    it("rejects 0 problem statements", () => {
      const result = onboardingSchema.safeParse({
        districtId: "dist-1",
        role: "literacy_director",
        problemIds: [],
      });
      expect(result.success).toBe(false);
    });

    it("rejects > 5 problem statements", () => {
      const result = onboardingSchema.safeParse({
        districtId: "dist-1",
        role: "literacy_director",
        problemIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects invalid role", () => {
      const result = onboardingSchema.safeParse({
        districtId: "dist-1",
        role: "ceo",
        problemIds: ["p1"],
      });
      expect(result.success).toBe(false);
    });

    it("rejects bio > 280 chars", () => {
      const result = onboardingSchema.safeParse({
        districtId: "dist-1",
        role: "literacy_director",
        problemIds: ["p1"],
        bio: "a".repeat(281),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Message schema", () => {
    it("accepts valid message", () => {
      const result = messageSchema.safeParse({
        conversationId: "conv-1",
        body: "Hello!",
      });
      expect(result.success).toBe(true);
    });

    it("rejects empty body", () => {
      const result = messageSchema.safeParse({
        conversationId: "conv-1",
        body: "",
      });
      expect(result.success).toBe(false);
    });

    it("rejects body > 5000 chars", () => {
      const result = messageSchema.safeParse({
        conversationId: "conv-1",
        body: "a".repeat(5001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("Message sanitization", () => {
    it("strips HTML tags from message body", () => {
      const result = sanitizeMessageBody("<script>alert('xss')</script>Hello");
      expect(result).toBe("Hello");
      expect(result).not.toContain("<script>");
    });

    it("strips all HTML including formatting", () => {
      const result = sanitizeMessageBody("<b>Bold</b> and <i>italic</i>");
      expect(result).toBe("Bold and italic");
    });

    it("preserves plain text", () => {
      const result = sanitizeMessageBody("Just a normal message");
      expect(result).toBe("Just a normal message");
    });

    it("handles empty input", () => {
      const result = sanitizeMessageBody("");
      expect(result).toBe("");
    });

    it("strips event handlers", () => {
      const result = sanitizeMessageBody('<img onerror="alert(1)" src="x">');
      expect(result).not.toContain("onerror");
      expect(result).not.toContain("alert");
    });

    it("strips iframe tags", () => {
      const result = sanitizeMessageBody('<iframe src="http://evil.com"></iframe>');
      expect(result).not.toContain("iframe");
    });
  });
});
