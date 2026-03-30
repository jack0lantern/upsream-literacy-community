import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (targetId === session.user.id) {
    return NextResponse.json({ error: "Cannot block yourself" }, { status: 400 });
  }

  // Idempotent: return 200 if already blocked
  const existing = await db.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
  });
  if (existing) {
    return NextResponse.json({ blocked: true }, { status: 200 });
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.userBlock.create({
        data: { blockerId: session.user.id, blockedId: targetId },
      });

      // Close any active or pending shared conversation
      const membership = await tx.conversationMember.findFirst({
        where: {
          userId: session.user.id,
          conversation: { members: { some: { userId: targetId } } },
        },
        include: { conversation: { select: { id: true, status: true } } },
      });

      if (
        membership?.conversation &&
        (membership.conversation.status === "active" ||
          membership.conversation.status === "pending")
      ) {
        await tx.conversation.update({
          where: { id: membership.conversation.id },
          data: { status: "closed" },
        });
      }
    });
  } catch (e: unknown) {
    // P2002 = unique constraint violation — concurrent create, treat as idempotent
    const err = e as { code?: string };
    if (err?.code === "P2002") {
      return NextResponse.json({ blocked: true }, { status: 200 });
    }
    throw e;
  }

  logger.info({ blockerId: session.user.id, blockedId: targetId }, "user blocked");
  return NextResponse.json({ blocked: true }, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.$transaction(async (tx) => {
    // Remove the block
    await tx.userBlock.deleteMany({
      where: { blockerId: session.user.id, blockedId: targetId },
    });

    // Reopen any conversation that was closed due to the block
    const membership = await tx.conversationMember.findFirst({
      where: {
        userId: session.user.id,
        conversation: {
          status: "closed",
          members: { some: { userId: targetId } },
        },
      },
      include: { conversation: { select: { id: true } } },
    });

    if (membership?.conversation) {
      await tx.conversation.update({
        where: { id: membership.conversation.id },
        data: { status: "active" },
      });
    }
  });

  return NextResponse.json({ blocked: false });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: targetId } = await params;
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const block = await db.userBlock.findUnique({
    where: { blockerId_blockedId: { blockerId: session.user.id, blockedId: targetId } },
  });

  return NextResponse.json({ blocked: !!block });
}
