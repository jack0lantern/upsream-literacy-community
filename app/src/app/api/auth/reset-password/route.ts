import { NextRequest, NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { z } from "zod/v4";

const schema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    const record = await db.passwordResetToken.findUnique({
      where: { token: parsed.data.token },
    });

    if (!record || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invalid or expired reset link." },
        { status: 400 }
      );
    }

    const passwordHash = await hash(parsed.data.password, 12);

    await db.user.update({
      where: { id: record.userId },
      data: { passwordHash },
    });

    await db.passwordResetToken.delete({ where: { id: record.id } });
    await trackEvent("password_reset", record.userId);

    return NextResponse.json({ message: "Password reset successful." });
  } catch (error) {
    logger.error({ error }, "Password reset error");
    return NextResponse.json({ error: "Something went wrong." }, { status: 500 });
  }
}
