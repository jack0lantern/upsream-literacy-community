import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Mute/unmute or report conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const membership = await db.conversationMember.findUnique({
    where: {
      conversationId_userId: { conversationId: id, userId: session.user.id },
    },
  });

  if (!membership) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();

  // Toggle mute
  if (body.action === "mute") {
    const newMuted = !membership.muted;
    await db.conversationMember.update({
      where: { id: membership.id },
      data: { muted: newMuted },
    });
    return NextResponse.json({ muted: newMuted });
  }

  // Report/flag
  if (body.action === "report") {
    await db.conversation.update({
      where: { id },
      data: { status: "flagged" },
    });
    return NextResponse.json({ status: "flagged" });
  }

  // Accept or reject a pending message request (recipient only)
  if (body.action === "accept" || body.action === "reject") {
    const conversation = await db.conversation.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!conversation) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (conversation.status !== "pending") {
      return NextResponse.json(
        { error: "Conversation is not pending" },
        { status: 400 }
      );
    }

    // Only the recipient (not the sender of the first message) may accept/reject
    const firstMessage = await db.message.findFirst({
      where: { conversationId: id },
      orderBy: { sentAt: "asc" },
      select: { senderId: true },
    });

    if (firstMessage?.senderId === session.user.id) {
      return NextResponse.json(
        { error: "Only the recipient can accept or reject a request" },
        { status: 403 }
      );
    }

    const newStatus = body.action === "accept" ? "active" : "rejected";
    await db.conversation.update({ where: { id }, data: { status: newStatus } });
    return NextResponse.json({ status: newStatus });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
