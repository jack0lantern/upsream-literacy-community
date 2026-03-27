import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimitSignup } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { z } from "zod/v4";

const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(100),
  districtId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? "unknown";
    const { allowed } = rateLimitSignup(ip);
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many signup attempts. Please try again later." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = signupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input.", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { email, password, name, districtId } = parsed.data;

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // Generic error to prevent email enumeration
      return NextResponse.json(
        { error: "Unable to create account. Please try a different email or log in." },
        { status: 400 }
      );
    }

    // Validate district exists if provided
    if (districtId) {
      const district = await db.district.findUnique({ where: { id: districtId } });
      if (!district) {
        return NextResponse.json(
          { error: "Selected district not found." },
          { status: 400 }
        );
      }
    }

    const passwordHash = await hash(password, 12);

    const user = await db.user.create({
      data: { email, passwordHash, name, districtId: districtId ?? null },
    });

    // Create email verification token
    const token = randomBytes(32).toString("hex");
    await db.emailVerificationToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
      },
    });

    // Send verification email (non-blocking)
    sendVerificationEmail(email, token).catch((err) => {
      logger.error({ err, userId: user.id }, "Failed to send verification email");
    });

    await trackEvent("signup", user.id);

    return NextResponse.json(
      { message: "Account created. Check your email to verify.", userId: user.id },
      { status: 201 }
    );
  } catch (error) {
    logger.error({ error }, "Signup error");
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
