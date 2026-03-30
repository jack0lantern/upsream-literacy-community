import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** List users the current user has blocked (for settings / unblock UI). */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const blocks = await db.userBlock.findMany({
    where: { blockerId: session.user.id },
    include: {
      blocked: {
        select: { id: true, name: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const users = blocks
    .filter((b) => b.blocked != null)
    .map((b) => ({
      id: b.blocked!.id,
      name: b.blocked!.name,
      status: b.blocked!.status,
    }));

  return NextResponse.json({ users });
}
