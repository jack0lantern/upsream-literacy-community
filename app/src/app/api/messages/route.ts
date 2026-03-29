import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sanitizeMessageBody } from "@/lib/sanitize";
import { rateLimitMessaging } from "@/lib/rate-limit";
import { trackEvent } from "@/lib/analytics";
import { logger } from "@/lib/logger";
import { z } from "zod/v4";

// In-memory email notification debounce
const emailDebounceMap = new Map<string, number>();
const DEBOUNCE_WINDOW = 15 * 60 * 1000; // 15 minutes

const messageSchema = z.object({
  conversationId: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is suspended
  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    select: { status: true },
  });
  if (currentUser?.status === "suspended") {
    return NextResponse.json(
      { error: "Your account is suspended. You cannot send messages." },
      { status: 403 }
    );
  }

  // Rate limit
  const { allowed } = rateLimitMessaging(session.user.id);
  if (!allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please slow down." },
      { status: 429 }
    );
  }

  const body = await request.json();
  const parsed = messageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { conversationId, body: rawBody } = parsed.data;

  // Verify membership
  const membership = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Check conversation status
  const conversation = await db.conversation.findUnique({
    where: { id: conversationId },
    select: { status: true },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  if (conversation.status === "closed" || conversation.status === "rejected") {
    return NextResponse.json(
      { error: "This conversation has been closed." },
      { status: 403 }
    );
  }

  if (conversation.status === "pending") {
    return NextResponse.json(
      { error: "This conversation is awaiting acceptance." },
      { status: 403 }
    );
  }

  // Fetch other conversation member (used for block check and email notification)
  const otherMember = await db.conversationMember.findFirst({
    where: { conversationId, userId: { not: session.user.id } },
    include: { user: { select: { id: true, email: true, status: true } } },
  });

  // Check if either party has blocked the other
  if (otherMember?.user) {
    const block = await db.userBlock.findFirst({
      where: {
        OR: [
          { blockerId: session.user.id, blockedId: otherMember.user.id },
          { blockerId: otherMember.user.id, blockedId: session.user.id },
        ],
      },
    });
    if (block) {
      return NextResponse.json(
        { error: "Cannot send messages to this user." },
        { status: 403 }
      );
    }
  }

  // Sanitize message body
  const sanitizedBody = sanitizeMessageBody(rawBody);
  if (!sanitizedBody.trim()) {
    return NextResponse.json(
      { error: "Message body is empty after sanitization" },
      { status: 400 }
    );
  }

  // Check keyword alerts
  const keywords = await db.keywordAlert.findMany({
    where: { active: true },
    select: { id: true, keyword: true },
  });

  const bodyLower = sanitizedBody.toLowerCase();
  const matchedKeywords = keywords.filter((k) =>
    bodyLower.includes(k.keyword.toLowerCase())
  );

  // Create message
  const message = await db.message.create({
    data: {
      conversationId,
      senderId: session.user.id,
      body: sanitizedBody,
      flagged: matchedKeywords.length > 0,
    },
    include: {
      sender: { select: { id: true, name: true } },
    },
  });

  // Update sender's lastReadAt
  await db.conversationMember.update({
    where: {
      conversationId_userId: {
        conversationId,
        userId: session.user.id,
      },
    },
    data: { lastReadAt: new Date() },
  });

  // Auto-flag conversation if keyword match
  if (matchedKeywords.length > 0) {
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: "flagged" },
    });
    // Increment hit counts
    for (const kw of matchedKeywords) {
      await db.keywordAlert.update({
        where: { id: kw.id },
        data: { hitCount: { increment: 1 } },
      });
    }
  }

  // Email notification with debouncing
  if (otherMember?.user && otherMember.user.status === "active" && !otherMember.muted) {
    const lastNotified = emailDebounceMap.get(otherMember.user.id) ?? 0;
    const now = Date.now();

    if (now - lastNotified > DEBOUNCE_WINDOW) {
      emailDebounceMap.set(otherMember.user.id, now);
      // Send email notification asynchronously
      import("@/lib/email")
        .then(({ sendMessageNotificationEmail }) =>
          sendMessageNotificationEmail(
            otherMember.user.email,
            session.user.name ?? "Someone",
            "",
            [],
            sanitizedBody.substring(0, 200),
            `${process.env.NEXT_PUBLIC_APP_URL}/messages/${conversationId}`
          )
        )
        .catch((err) => {
          logger.error({ err }, "Failed to send message notification email");
        });
    }
  }

  await trackEvent("message_sent", session.user.id, { conversationId });

  return NextResponse.json(message, { status: 201 });
}
