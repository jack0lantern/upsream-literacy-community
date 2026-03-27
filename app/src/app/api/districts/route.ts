import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod/v4";

const manualDistrictSchema = z.object({
  name: z.string().min(1).max(200),
  state: z.string().length(2),
  totalEnrollment: z.number().int().positive().optional(),
  frlPct: z.number().min(0).max(100).optional(),
  ellPct: z.number().min(0).max(100).optional(),
  urbanicity: z.enum(["urban", "suburban", "town", "rural"]).optional(),
});

// Create manual district entry
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = manualDistrictSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { totalEnrollment, ...rest } = parsed.data;

  let sizeBucket: "small" | "medium" | "large" | "very_large" | undefined;
  if (totalEnrollment) {
    if (totalEnrollment < 3000) sizeBucket = "small";
    else if (totalEnrollment < 15000) sizeBucket = "medium";
    else if (totalEnrollment < 50000) sizeBucket = "large";
    else sizeBucket = "very_large";
  }

  const district = await db.district.create({
    data: {
      ...rest,
      totalEnrollment: totalEnrollment ?? null,
      sizeBucket: sizeBucket ?? null,
      isManual: true,
    },
  });

  return NextResponse.json(district, { status: 201 });
}
