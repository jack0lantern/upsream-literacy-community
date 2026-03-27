import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod/v4";

// Get current user profile
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      district: true,
      problems: { include: { problem: true } },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio,
    onboarded: user.onboarded,
    emailVerified: user.emailVerified,
    district: user.district,
    problems: user.problems.map((up) => up.problem),
    lastActiveAt: user.lastActiveAt,
    createdAt: user.createdAt,
  });
}

const updateSchema = z.object({
  bio: z.string().max(280).optional(),
  problemIds: z.array(z.string()).min(1).max(5).optional(),
  districtId: z.string().optional(),
  role: z
    .enum([
      "literacy_director",
      "curriculum_coordinator",
      "literacy_coach",
      "mtss_coordinator",
      "other",
    ])
    .optional(),
});

// Update profile
export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { bio, problemIds, districtId, role } = parsed.data;

  const updateData: Record<string, unknown> = {};
  if (bio !== undefined) updateData.bio = bio;
  if (role !== undefined) updateData.role = role;
  if (districtId !== undefined) {
    const district = await db.district.findUnique({ where: { id: districtId } });
    if (!district) {
      return NextResponse.json({ error: "District not found" }, { status: 400 });
    }
    updateData.districtId = districtId;
  }

  const ops = [];
  if (Object.keys(updateData).length > 0) {
    ops.push(db.user.update({ where: { id: session.user.id }, data: updateData }));
  }

  if (problemIds) {
    ops.push(db.userProblem.deleteMany({ where: { userId: session.user.id } }));
    for (const problemId of problemIds) {
      ops.push(
        db.userProblem.create({
          data: { userId: session.user.id, problemId },
        })
      );
    }
  }

  if (ops.length > 0) {
    await db.$transaction(ops);
  }

  return NextResponse.json({ success: true });
}

// Deactivate account
export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await db.user.update({
    where: { id: session.user.id },
    data: { status: "deactivated" },
  });

  return NextResponse.json({ success: true });
}
