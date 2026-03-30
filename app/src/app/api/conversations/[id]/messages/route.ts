import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  filterMessagesVisibleToViewer,
  getBlockedUserIdsForViewer,
} from "@/lib/message-visibility";

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

  const rawMessages = await db.message.findMany({
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

  const blockedUserIds = await getBlockedUserIdsForViewer(session.user.id);
  const messages = filterMessagesVisibleToViewer(
    rawMessages,
    session.user.id,
    blockedUserIds
  );

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

  // Mark messages from the other user as read only when those messages are visible to this viewer
  if (messages.length > 0) {
    const blockedArr = [...blockedUserIds];
    await db.message.updateMany({
      where: {
        conversationId: id,
        readAt: null,
        AND: [
          { senderId: { not: session.user.id } },
          ...(blockedArr.length > 0 ? [{ senderId: { notIn: blockedArr } }] : []),
        ],
      },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json(messages);
}
