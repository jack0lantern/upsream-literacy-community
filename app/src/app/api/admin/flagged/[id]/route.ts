import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Get full message thread for flagged conversation
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      },
      messages: {
        orderBy: { sentAt: "asc" },
        include: {
          sender: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(conversation);
}

// Admin actions on flagged conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!admin?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { action, userId, messageId } = await request.json();

  if (action === "close") {
    await db.conversation.update({
      where: { id },
      data: { status: "closed" },
    });
  } else if (action === "resolve") {
    await db.conversation.update({
      where: { id },
      data: { status: "active" },
    });
  } else if (action === "suspend_user" && userId) {
    await db.user.update({
      where: { id: userId },
      data: { status: "suspended" },
    });
  } else if (action === "delete_message" && messageId) {
    await db.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date() },
    });
  }

  return NextResponse.json({ success: true });
}
