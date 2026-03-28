"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { MatchCardSkeleton } from "@/components/loading-skeleton";
import { US_STATES } from "@/lib/us-states";

const ROLE_LABELS: Record<string, string> = {
  literacy_director: "Literacy Director",
  curriculum_coordinator: "Curriculum Coordinator",
  literacy_coach: "Literacy Coach",
  mtss_coordinator: "MTSS Coordinator",
  other: "Other",
};

interface Match {
  user: {
    id: string;
    name: string;
    role: string | null;
    bio: string | null;
    lastActiveAt: string | null;
  };
  district: {
    id: string;
    name: string;
    state: string;
    urbanicity: string | null;
    totalEnrollment: number | null;
    sizeBucket: string | null;
    frlPct: number | null;
    ellPct: number | null;
    isCharterAgency: boolean | null;
  } | null;
  sharedProblems: string[];
  score: number;
  breakdown: {
    problemOverlap: number;
    sizeMatch: number;
    urbanicityMatch: number;
    frlSimilarity: number;
    ellSimilarity: number;
  };
}

interface ProblemStatement {
  id: string;
  label: string;
  category: string;
}

function getMatchLabel(score: number): string {
  if (score >= 75) return "Strong match";
  if (score >= 50) return "Good match";
  return "Fair match";
}

function getActivityLabel(lastActiveAt: string | null): string {
  if (!lastActiveAt) return "New member";
  const diff = Date.now() - new Date(lastActiveAt).getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) return "Active today";
  if (days < 7) return "Active this week";
  if (days < 30) return "Active this month";
  return "Inactive";
}

export default function DashboardPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Filters
  const [sort, setSort] = useState("score");
  const [filterRole, setFilterRole] = useState("");
  const [filterChallenge, setFilterChallenge] = useState("");
  const [filterState, setFilterState] = useState("");
  const [filterStateScope, setFilterStateScope] = useState("");
  const [filterUrbanicity, setFilterUrbanicity] = useState("");
  const [filterSizeBucket, setFilterSizeBucket] = useState("");
  const [filterCharter, setFilterCharter] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Problem lookup map
  const problemMap = problems.reduce(
    (acc, p) => ({ ...acc, [p.id]: p.label }),
    {} as Record<string, string>
  );

  useEffect(() => {
    fetch("/api/problems")
      .then((res) => res.json())
      .then(setProblems)
      .catch(() => {});
  }, []);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort });
    if (filterRole) params.set("role", filterRole);
    if (filterChallenge) params.set("problemIds", filterChallenge);
    if (filterState) params.set("state", filterState);
    if (filterStateScope) params.set("stateScope", filterStateScope);
    if (filterUrbanicity) params.set("urbanicity", filterUrbanicity);
    if (filterSizeBucket) params.set("sizeBucket", filterSizeBucket);
    if (filterCharter) params.set("charter", filterCharter);

    const res = await fetch(`/api/matches?${params}`);
    const data = await res.json();
    setMatches(data.matches ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
  }, [page, sort, filterRole, filterChallenge, filterState, filterStateScope, filterUrbanicity, filterSizeBucket, filterCharter]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    setPage(1);
  }, [filterRole, filterChallenge, filterState, filterStateScope, filterUrbanicity, filterSizeBucket, filterCharter]);

  function buildMatchSummary(match: Match): string {
    const parts: string[] = [];
    if (match.sharedProblems.length > 0) {
      parts.push(
        `${match.sharedProblems.length} shared challenge${match.sharedProblems.length > 1 ? "s" : ""}`
      );
    }
    if (match.breakdown.sizeMatch >= 20) parts.push("similar size");
    else if (match.breakdown.sizeMatch >= 10) parts.push("comparable size");
    if (match.breakdown.urbanicityMatch >= 20)
      parts.push("same community type");
    return parts.length > 0
      ? `${getMatchLabel(match.score)} — ${parts.join(", ")}`
      : getMatchLabel(match.score);
  }

  const SORT_LABELS: Record<string, string> = {
    score: "Match score",
    recent: "Recently active",
  };

  const URBANICITY_LABELS: Record<string, string> = {
    urban: "Urban",
    suburban: "Suburban",
    town: "Town",
    rural: "Rural",
  };

  const SIZE_LABELS: Record<string, string> = {
    small: "Small (<3K)",
    medium: "Medium (3K-15K)",
    large: "Large (15K-50K)",
    very_large: "Very Large (50K+)",
  };

  const STATE_SCOPE_LABELS: Record<string, string> = {
    same: "Same state as me",
    different: "Different state",
  };

  const CHARTER_LABELS: Record<string, string> = {
    charter: "Charter district only",
    traditional: "Traditional only",
  };

  const filterContent = (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1.5 block">Sort by</label>
        <Select value={sort} onValueChange={(v) => v && setSort(v)}>
          <SelectTrigger>
            <SelectValue>{(v: string) => SORT_LABELS[v] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="score">Match score</SelectItem>
            <SelectItem value="recent">Recently active</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Role</label>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="All roles">
              {(v: string) => ROLE_LABELS[v] ?? "All roles"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">Challenge</label>
        <Select value={filterChallenge} onValueChange={(v) => setFilterChallenge(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="Any challenge">
              {(v: string) => problemMap[v] ?? "Any challenge"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Any challenge</SelectItem>
            {problems.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">State</label>
        <Select
          value={filterStateScope || filterState}
          onValueChange={(v) => {
            if (v === "same" || v === "different") {
              setFilterStateScope(v);
              setFilterState("");
            } else {
              setFilterStateScope("");
              setFilterState(v ?? "");
            }
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="All states">
              {(v: string) => STATE_SCOPE_LABELS[v] ?? (v || "All states")}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All states</SelectItem>
            <SelectItem value="same">Same state as me</SelectItem>
            <SelectItem value="different">Different state</SelectItem>
            {US_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          District type
        </label>
        <Select value={filterUrbanicity} onValueChange={(v) => setFilterUrbanicity(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="All types">
              {(v: string) => URBANICITY_LABELS[v] ?? "All types"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All types</SelectItem>
            <SelectItem value="urban">Urban</SelectItem>
            <SelectItem value="suburban">Suburban</SelectItem>
            <SelectItem value="town">Town</SelectItem>
            <SelectItem value="rural">Rural</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          District size
        </label>
        <Select value={filterSizeBucket} onValueChange={(v) => setFilterSizeBucket(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="All sizes">
              {(v: string) => SIZE_LABELS[v] ?? "All sizes"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All sizes</SelectItem>
            <SelectItem value="small">Small (&lt;3K)</SelectItem>
            <SelectItem value="medium">Medium (3K-15K)</SelectItem>
            <SelectItem value="large">Large (15K-50K)</SelectItem>
            <SelectItem value="very_large">Very Large (50K+)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <label className="text-sm font-medium mb-1.5 block">
          Charter (LEA)
        </label>
        <Select value={filterCharter} onValueChange={(v) => setFilterCharter(v ?? "")}>
          <SelectTrigger>
            <SelectValue placeholder="All">
              {(v: string) => CHARTER_LABELS[v] ?? "All"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="charter">Charter district only</SelectItem>
            <SelectItem value="traditional">Traditional only</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {(filterRole || filterChallenge || filterState || filterStateScope || filterUrbanicity || filterSizeBucket || filterCharter) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setFilterRole("");
            setFilterChallenge("");
            setFilterState("");
            setFilterStateScope("");
            setFilterUrbanicity("");
            setFilterSizeBucket("");
            setFilterCharter("");
          }}
        >
          Clear filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Desktop filter sidebar */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20">
          <h2 className="font-semibold mb-4">Filters</h2>
          {filterContent}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Discover Matches</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {loading ? "Finding matches..." : `${total} peers found`}
            </p>
          </div>
          {/* Mobile filter button */}
          <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <SheetTrigger
              render={(props) => <Button variant="outline" size="sm" className="lg:hidden" {...props}>Filters</Button>}
            />
            <SheetContent side="bottom" className="h-[70vh] rounded-t-xl">
              <SheetTitle>Filters</SheetTitle>
              <div className="mt-4">{filterContent}</div>
              <Button
                className="w-full mt-6"
                onClick={() => setMobileFilterOpen(false)}
              >
                Apply filters
              </Button>
            </SheetContent>
          </Sheet>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <EmptyState
            title="No matches yet"
            description="We couldn't find peers matching your profile right now. Try adjusting your filters, or check back as more members join."
            action={
              <div className="flex flex-col gap-2 items-center">
                <Link href="/profile">
                  <Button variant="outline">Update your challenges</Button>
                </Link>
              </div>
            }
          />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {matches.map((match) => (
                <Link
                  key={match.user.id}
                  href={`/profile/${match.user.id}`}
                >
                  <Card className="hover:shadow-md transition-shadow h-full">
                    <CardHeader className="flex flex-row items-start gap-3 pb-3">
                      <UserAvatar name={match.user.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold truncate">
                            {match.user.name}
                          </h3>
                          <Badge
                            variant="secondary"
                            className="shrink-0 text-xs"
                          >
                            {match.score}%
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {match.user.role
                            ? ROLE_LABELS[match.user.role] ?? match.user.role
                            : "Member"}
                        </p>
                        {match.district && (
                          <p className="text-xs text-muted-foreground">
                            {match.district.name}, {match.district.state}
                            {match.district.isCharterAgency === true && " · Charter LEA"}
                            {match.district.totalEnrollment &&
                              ` · ${match.district.totalEnrollment.toLocaleString()} students`}
                          </p>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        {buildMatchSummary(match)}
                      </p>
                      {match.sharedProblems.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {match.sharedProblems.map((pid) => (
                            <Badge
                              key={pid}
                              variant="outline"
                              className="text-xs font-normal"
                            >
                              {problemMap[pid] ?? "Shared challenge"}
                            </Badge>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {getActivityLabel(match.user.lastActiveAt)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="flex items-center text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
