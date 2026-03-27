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

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
