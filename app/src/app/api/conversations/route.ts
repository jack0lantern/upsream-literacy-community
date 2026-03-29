import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

// List conversations for current user
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");

  // Fetch all memberships for current user (all statuses)
  const memberships = await db.conversationMember.findMany({
    where: { userId: session.user.id },
    include: {
      conversation: {
        include: {
          members: {
            include: {
              user: {
                select: { id: true, name: true, role: true, status: true },
              },
            },
          },
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            where: { deletedAt: null },
            select: {
              id: true,
              body: true,
              sentAt: true,
              senderId: true,
              readAt: true,
            },
          },
        },
      },
    },
  });

  // Fetch IDs of users who have blocked the current user
  const blockerIds = new Set(
    (
      await db.userBlock.findMany({
        where: { blockedId: session.user.id },
        select: { blockerId: true },
      })
    ).map((b) => b.blockerId)
  );

  const conversations = memberships
    .filter((m) => {
      const status = m.conversation.status;
      const otherMember = m.conversation.members.find(
        (cm) => cm.userId !== session.user.id
      );
      const otherUserId = otherMember?.userId ?? "";

      // Requests tab: only pending conversations
      if (type === "requests") {
        return status === "pending";
      }

      // Default list: only active/flagged, excluding blocked-by relationships
      if (status !== "active" && status !== "flagged") return false;
      if (blockerIds.has(otherUserId)) return false;
      return true;
    })
    .map((m) => {
      const otherMember = m.conversation.members.find(
        (cm) => cm.userId !== session.user.id
      );
      const lastMessage = m.conversation.messages[0] ?? null;
      const unreadCutoff = m.lastReadAt ?? new Date(0);

      return {
        id: m.conversation.id,
        status: m.conversation.status,
        muted: m.muted,
        otherUser: otherMember?.user ?? null,
        lastMessage,
        lastReadAt: m.lastReadAt,
        hasUnread:
          lastMessage &&
          lastMessage.senderId !== session.user.id &&
          lastMessage.sentAt > unreadCutoff,
        createdAt: m.conversation.createdAt,
      };
    });

  // Deduplicate by other user (keep most recent)
  const deduped = new Map<string, (typeof conversations)[number]>();
  for (const conv of conversations) {
    const key = conv.otherUser?.id ?? conv.id;
    const existing = deduped.get(key);
    if (!existing) {
      deduped.set(key, conv);
    } else {
      const existingTime =
        existing.lastMessage?.sentAt.getTime() ?? existing.createdAt.getTime();
      const convTime =
        conv.lastMessage?.sentAt.getTime() ?? conv.createdAt.getTime();
      if (convTime > existingTime) deduped.set(key, conv);
    }
  }

  const result = Array.from(deduped.values());
  result.sort((a, b) => {
    const aTime = a.lastMessage?.sentAt.getTime() ?? a.createdAt.getTime();
    const bTime = b.lastMessage?.sentAt.getTime() ?? b.createdAt.getTime();
    return bTime - aTime;
  });

  return NextResponse.json(result);
}

// Create a new conversation
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipientId } = await request.json();
  if (!recipientId) {
    return NextResponse.json(
      { error: "recipientId is required" },
      { status: 400 }
    );
  }

  if (recipientId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot create conversation with yourself" },
      { status: 400 }
    );
  }

  // Check recipient exists and is active
  const recipient = await db.user.findUnique({
    where: { id: recipientId, status: "active" },
  });
  if (!recipient) {
    return NextResponse.json(
      { error: "User not found" },
      { status: 404 }
    );
  }

  // Check-and-create inside a serializable transaction to prevent race duplicates
  const { conversationId, created } = await db.$transaction(async (tx) => {
    const existing = await tx.conversationMember.findFirst({
      where: {
        userId: session.user.id,
        conversation: {
          members: { some: { userId: recipientId } },
        },
      },
      select: { conversationId: true },
    });

    if (existing) {
      return { conversationId: existing.conversationId, created: false };
    }

    const conversation = await tx.conversation.create({
      data: {
        members: {
          create: [
            { userId: session.user.id },
            { userId: recipientId },
          ],
        },
      },
    });

    return { conversationId: conversation.id, created: true };
  });

  if (created) {
    await trackEvent("conversation_started", session.user.id, {
      recipientId,
      conversationId,
    });
  }

  return NextResponse.json(
    { conversationId },
    { status: created ? 201 : 200 }
  );
}
