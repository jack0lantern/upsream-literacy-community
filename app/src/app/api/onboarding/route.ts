import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";
import { z } from "zod/v4";

const onboardingSchema = z.object({
  districtId: z.string().min(1),
  role: z.enum([
    "literacy_director",
    "curriculum_coordinator",
    "literacy_coach",
    "mtss_coordinator",
    "other",
  ]),
  problemIds: z.array(z.string()).min(1).max(5),
  bio: z.string().max(280).optional(),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { districtId, role, problemIds, bio } = parsed.data;

  // Verify district exists
  const district = await db.district.findUnique({ where: { id: districtId } });
  if (!district) {
    return NextResponse.json({ error: "District not found" }, { status: 400 });
  }

  // Verify problem statements exist
  const problems = await db.problemStatement.findMany({
    where: { id: { in: problemIds }, active: true },
  });
  if (problems.length !== problemIds.length) {
    return NextResponse.json(
      { error: "One or more problem statements not found" },
      { status: 400 }
    );
  }

  // Update user profile and create problem associations
  await db.$transaction([
    db.user.update({
      where: { id: session.user.id },
      data: {
        districtId,
        role,
        bio: bio ?? null,
        onboarded: true,
      },
    }),
    // Clear existing and re-create
    db.userProblem.deleteMany({ where: { userId: session.user.id } }),
    ...problemIds.map((problemId) =>
      db.userProblem.create({
        data: { userId: session.user.id, problemId },
      })
    ),
  ]);

  await trackEvent("profile_complete", session.user.id, {
    districtId,
    role,
    problemCount: problemIds.length,
  });

  return NextResponse.json({ success: true });
}
