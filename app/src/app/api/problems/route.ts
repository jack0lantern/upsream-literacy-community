import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const problems = await db.problemStatement.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, label: true, category: true, sortOrder: true },
  });

  return NextResponse.json(problems);
}
