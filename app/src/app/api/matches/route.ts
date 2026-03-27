import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { trackEvent } from "@/lib/analytics";

// Adjacency maps for scoring
const URBANICITY_ADJACENCY: Record<string, string[]> = {
  urban: ["suburban"],
  suburban: ["urban", "town"],
  town: ["suburban", "rural"],
  rural: ["town"],
};

const SIZE_ORDER = ["small", "medium", "large", "very_large"];

function sizeBucketDistance(a: string | null, b: string | null): number {
  if (!a || !b) return 3;
  const ai = SIZE_ORDER.indexOf(a);
  const bi = SIZE_ORDER.indexOf(b);
  if (ai === -1 || bi === -1) return 3;
  return Math.abs(ai - bi);
}

function urbanicityScore(a: string | null, b: string | null): number {
  if (!a || !b) return 10; // neutral when unknown
  if (a === b) return 20;
  if (URBANICITY_ADJACENCY[a]?.includes(b)) return 10;
  return 0;
}

function sizeScore(a: string | null, b: string | null): number {
  if (!a || !b) return 10; // neutral when unknown
  const dist = sizeBucketDistance(a, b);
  if (dist === 0) return 20;
  if (dist === 1) return 10;
  return 0;
}

function frlScore(a: number | null, b: number | null): number {
  if (a == null || b == null) return 5; // neutral when unknown
  return Math.max(0, 10 - Math.abs(a - b) / 5);
}

function ellScore(a: number | null, b: number | null): number {
  if (a == null || b == null) return 5;
  return Math.max(0, 10 - Math.abs(a - b) / 3);
}

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const sort = searchParams.get("sort") ?? "score";
  const filterState = searchParams.get("state");
  const filterUrbanicity = searchParams.get("urbanicity");
  const filterSizeBucket = searchParams.get("sizeBucket");
  const filterProblemIds = searchParams.get("problemIds")?.split(",").filter(Boolean);

  // Get current user with district and problems
  const currentUser = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      district: true,
      problems: { select: { problemId: true } },
    },
  });

  if (!currentUser?.district || !currentUser.onboarded) {
    return NextResponse.json({ matches: [], total: 0 });
  }

  const myProblemIds = new Set(currentUser.problems.map((p) => p.problemId));

  // Build where clause for candidates
  const whereClause: Record<string, unknown> = {
    id: { not: currentUser.id },
    status: "active",
    onboarded: true,
  };

  if (filterState) {
    whereClause.district = { ...((whereClause.district as object) ?? {}), state: filterState };
  }
  if (filterUrbanicity) {
    whereClause.district = { ...((whereClause.district as object) ?? {}), urbanicity: filterUrbanicity };
  }
  if (filterSizeBucket) {
    whereClause.district = { ...((whereClause.district as object) ?? {}), sizeBucket: filterSizeBucket };
  }

  // Get candidate users
  let candidates = await db.user.findMany({
    where: whereClause,
    include: {
      district: true,
      problems: { select: { problemId: true } },
    },
  });

  // Filter by specific problem IDs if requested
  if (filterProblemIds && filterProblemIds.length > 0) {
    const filterSet = new Set(filterProblemIds);
    candidates = candidates.filter((c) =>
      c.problems.some((p) => filterSet.has(p.problemId))
    );
  }

  // Score each candidate
  const scored = candidates
    .map((candidate) => {
      const candidateProblemIds = new Set(
        candidate.problems.map((p) => p.problemId)
      );

      // Problem overlap score (40%)
      const shared = [...myProblemIds].filter((id) => candidateProblemIds.has(id));
      const maxProblems = Math.max(myProblemIds.size, candidateProblemIds.size);
      const problemScore =
        maxProblems > 0 ? (shared.length / maxProblems) * 40 : 0;

      // Demographic scores
      const myDistrict = currentUser.district!;
      const theirDistrict = candidate.district;

      const sizeS = sizeScore(
        myDistrict.sizeBucket,
        theirDistrict?.sizeBucket ?? null
      );
      const urbanS = urbanicityScore(
        myDistrict.urbanicity,
        theirDistrict?.urbanicity ?? null
      );
      const frlS = frlScore(myDistrict.frlPct, theirDistrict?.frlPct ?? null);
      const ellS = ellScore(myDistrict.ellPct, theirDistrict?.ellPct ?? null);

      const totalScore = Math.round(problemScore + sizeS + urbanS + frlS + ellS);

      return {
        user: {
          id: candidate.id,
          name: candidate.name,
          role: candidate.role,
          bio: candidate.bio,
          lastActiveAt: candidate.lastActiveAt,
        },
        district: theirDistrict
          ? {
              id: theirDistrict.id,
              name: theirDistrict.name,
              state: theirDistrict.state,
              urbanicity: theirDistrict.urbanicity,
              totalEnrollment: theirDistrict.totalEnrollment,
              sizeBucket: theirDistrict.sizeBucket,
              frlPct: theirDistrict.frlPct,
              ellPct: theirDistrict.ellPct,
            }
          : null,
        sharedProblems: shared,
        score: totalScore,
        breakdown: {
          problemOverlap: Math.round(problemScore),
          sizeMatch: sizeS,
          urbanicityMatch: urbanS,
          frlSimilarity: Math.round(frlS * 10) / 10,
          ellSimilarity: Math.round(ellS * 10) / 10,
        },
      };
    })
    .filter((m) => m.score >= 30); // Minimum threshold

  // Sort
  if (sort === "recent") {
    scored.sort((a, b) => {
      const aTime = a.user.lastActiveAt?.getTime() ?? 0;
      const bTime = b.user.lastActiveAt?.getTime() ?? 0;
      return bTime - aTime;
    });
  } else {
    scored.sort((a, b) => b.score - a.score);
  }

  const total = scored.length;
  const paginated = scored.slice((page - 1) * limit, page * limit);

  // Track view
  trackEvent("match_viewed", session.user.id, {
    resultCount: total,
    page,
    filters: { filterState, filterUrbanicity, filterSizeBucket },
  });

  return NextResponse.json({
    matches: paginated,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
