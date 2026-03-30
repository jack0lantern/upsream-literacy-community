import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { sanitizeMessageBody } from "@/lib/sanitize";
import {
  getBlockedUserIdsForViewer,
  isMessageVisibleToViewer,
} from "@/lib/message-visibility";

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
            take: 40,
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

  const blockedUserIds = await getBlockedUserIdsForViewer(session.user.id);

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
      const lastMessage =
        m.conversation.messages.find((msg) =>
          isMessageVisibleToViewer(msg, session.user.id, blockedUserIds)
        ) ?? null;
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

  const { recipientId, body } = await request.json();
  if (!recipientId) {
    return NextResponse.json({ error: "recipientId is required" }, { status: 400 });
  }
  if (!body || typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  if (recipientId === session.user.id) {
    return NextResponse.json(
      { error: "Cannot create conversation with yourself" },
      { status: 400 }
    );
  }

  const recipient = await db.user.findUnique({
    where: { id: recipientId, status: "active" },
  });
  if (!recipient) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Check if recipient has blocked sender
  const block = await db.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: recipientId, blockedId: session.user.id } },
  });
  if (block) {
    return NextResponse.json({ error: "Cannot message this user" }, { status: 403 });
  }

  // Check for existing conversation (any status)
  const existingMembership = await db.conversationMember.findFirst({
    where: {
      userId: session.user.id,
      conversation: { members: { some: { userId: recipientId } } },
    },
    include: { conversation: { select: { id: true, status: true } } },
  });

  if (existingMembership?.conversation) {
    const { id: existingId, status } = existingMembership.conversation;
    if (status === "rejected") {
      return NextResponse.json(
        { error: "Cannot send another request to this user" },
        { status: 403 }
      );
    }
    // Reopen closed conversations as a new pending request with the new message
    if (status === "closed") {
      const sanitized = sanitizeMessageBody(body.trim());
      await db.$transaction(async (tx) => {
        await tx.conversation.update({
          where: { id: existingId },
          data: { status: "pending" },
        });
        if (sanitized) {
          await tx.message.create({
            data: {
              conversationId: existingId,
              senderId: session.user.id,
              body: sanitized,
            },
          });
        }
      });
    }
    return NextResponse.json({ conversationId: existingId }, { status: 200 });
  }

  const sanitizedBody = sanitizeMessageBody(body.trim());
  if (!sanitizedBody.trim()) {
    return NextResponse.json(
      { error: "Message body is empty after sanitization" },
      { status: 400 }
    );
  }

  const { conversationId } = await db.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({
      data: {
        status: "pending",
        members: {
          create: [{ userId: session.user.id }, { userId: recipientId }],
        },
      },
    });

    await tx.message.create({
      data: {
        conversationId: conversation.id,
        senderId: session.user.id,
        body: sanitizedBody,
      },
    });

    return { conversationId: conversation.id };
  });

  await trackEvent("conversation_started", session.user.id, { recipientId, conversationId });

  return NextResponse.json({ conversationId }, { status: 201 });
}
