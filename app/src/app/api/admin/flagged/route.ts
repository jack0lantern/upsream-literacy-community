import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });
  if (!user?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const conversations = await db.conversation.findMany({
    where: { status: "flagged" },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      },
      messages: {
        orderBy: { sentAt: "desc" },
        take: 1,
        where: { deletedAt: null },
        select: { body: true, sentAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    conversations.map((c) => ({
      id: c.id,
      status: c.status,
      participants: c.members.map((m) => m.user),
      lastMessage: c.messages[0] ?? null,
      createdAt: c.createdAt,
    }))
  );
}
