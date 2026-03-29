import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
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

  const status = request.nextUrl.searchParams.get("status") ?? "pending";

  const reports = await db.report.findMany({
    where: { status: status as "pending" | "dismissed" | "actioned" },
    include: {
      reporter: { select: { id: true, name: true } },
      reportedUser: { select: { id: true, name: true } },
      message: { select: { id: true, body: true, conversationId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(reports);
}
