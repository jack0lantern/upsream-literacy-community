import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const record = await db.emailVerificationToken.findUnique({
    where: { token },
    include: { user: true },
  });

  if (!record || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "Invalid or expired verification link." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: record.userId },
    data: { emailVerified: true },
  });

  await db.emailVerificationToken.delete({ where: { id: record.id } });

  return NextResponse.redirect(
    new URL("/dashboard?verified=true", request.url)
  );
}
