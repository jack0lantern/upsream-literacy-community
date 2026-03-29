import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

async function isAdmin(session: Awaited<ReturnType<typeof auth>>): Promise<boolean> {
  return session?.user?.role === "admin";
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user || !(await isAdmin(session))) {
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !(await isAdmin(session))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { action } = body ?? {};

  if (action !== "dismiss" && action !== "suspend") {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const report = await db.report.findUnique({
    where: { id },
    select: { reportedUserId: true },
  });
  if (!report) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  if (action === "dismiss") {
    await db.report.update({
      where: { id },
      data: { status: "dismissed", reviewedById: session.user.id, reviewedAt: new Date() },
    });
    logger.info({ reportId: id, adminId: session.user.id }, "report dismissed");
    return NextResponse.json({ status: "dismissed" });
  }

  // suspend
  await db.$transaction([
    db.report.update({
      where: { id },
      data: { status: "actioned", reviewedById: session.user.id, reviewedAt: new Date() },
    }),
    db.user.update({
      where: { id: report.reportedUserId },
      data: { status: "suspended" },
    }),
  ]);
  logger.info(
    { reportId: id, adminId: session.user.id, suspendedUserId: report.reportedUserId },
    "user suspended via report"
  );
  return NextResponse.json({ status: "actioned" });
}
