import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sanitizeMessageBody } from "@/lib/sanitize";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { messageId, reason } = body ?? {};

  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json({ error: "messageId is required" }, { status: 400 });
  }
  if (!reason || typeof reason !== "string" || !reason.trim()) {
    return NextResponse.json({ error: "reason is required" }, { status: 400 });
  }

  // Verify the message exists
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: { senderId: true },
  });
  if (!message) {
    return NextResponse.json({ error: "Message not found" }, { status: 404 });
  }

  const sanitizedReason = sanitizeMessageBody(reason.trim()).slice(0, 500);

  const report = await db.report.create({
    data: {
      reporterId: session.user.id,
      reportedUserId: message.senderId,
      messageId,
      reason: sanitizedReason,
    },
  });

  logger.info({ reportId: report.id, reporterId: session.user.id, messageId }, "report filed");
  return NextResponse.json({ id: report.id }, { status: 201 });
}
