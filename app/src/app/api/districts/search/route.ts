import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const state = request.nextUrl.searchParams.get("state")?.trim();

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const districts = await db.district.findMany({
    where: {
      AND: [
        { name: { contains: q, mode: "insensitive" } },
        ...(state ? [{ state: state.toUpperCase() }] : []),
      ],
    },
    take: 10,
    orderBy: { name: "asc" },
    select: {
      id: true,
      ncesId: true,
      name: true,
      state: true,
      urbanicity: true,
      totalEnrollment: true,
      sizeBucket: true,
      frlPct: true,
      ellPct: true,
    },
  });

  return NextResponse.json(districts);
}
