import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import { z } from "zod/v4";

const schema = z.object({ email: z.email() });

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Generic response to prevent email enumeration
    const genericResponse = NextResponse.json({
      message: "If an account exists with that email, you'll receive a reset link.",
    });

    const user = await db.user.findUnique({
      where: { email: parsed.data.email },
    });
    if (!user) return genericResponse;

    // Delete existing reset token if any
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const token = randomBytes(32).toString("hex");
    await db.passwordResetToken.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    sendPasswordResetEmail(user.email, token).catch((err) => {
      logger.error({ err, userId: user.id }, "Failed to send password reset email");
    });

    return genericResponse;
  } catch (error) {
    logger.error({ error }, "Forgot password error");
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
