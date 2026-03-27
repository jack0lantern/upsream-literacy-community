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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    activeUsers,
    messagesThisWeek,
    flaggedConversations,
    totalConversations,
    zeroMatchUsers,
  ] = await Promise.all([
    db.user.count({ where: { status: "active" } }),
    db.user.count({
      where: { status: "active", lastActiveAt: { gte: sevenDaysAgo } },
    }),
    db.message.count({ where: { sentAt: { gte: sevenDaysAgo } } }),
    db.conversation.count({ where: { status: "flagged" } }),
    db.conversation.count(),
    db.user.count({
      where: { status: "active", onboarded: true, problems: { none: {} } },
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    activeUsers,
    messagesThisWeek,
    flaggedConversations,
    totalConversations,
    zeroMatchUsers,
  });
}
