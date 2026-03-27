import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Get messages for a conversation (supports polling with ?since=)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify membership
  const membership = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = request.nextUrl.searchParams.get("since");
  const sinceDate = since ? new Date(since) : undefined;

  const messages = await db.message.findMany({
    where: {
      conversationId: id,
      deletedAt: null,
      ...(sinceDate ? { sentAt: { gt: sinceDate } } : {}),
    },
    orderBy: { sentAt: "asc" },
    include: {
      sender: {
        select: { id: true, name: true },
      },
    },
    take: 100,
  });

  // Update lastReadAt
  await db.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  });

  // Mark messages from other user as read
  if (messages.length > 0) {
    await db.message.updateMany({
      where: {
        conversationId: id,
        senderId: { not: session.user.id },
        readAt: null,
      },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json(messages);
}
