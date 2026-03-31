"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
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
import { ChevronDown } from "lucide-react";
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
  const [filterChallenges, setFilterChallenges] = useState<Set<string>>(new Set());
  const [filterState, setFilterState] = useState("");
  const [myUserState, setMyUserState] = useState<string | null>(null);
  const [filterUrbanicity, setFilterUrbanicity] = useState("");
  const [filterSizeBucket, setFilterSizeBucket] = useState("");
  const [filterCharter, setFilterCharter] = useState("");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  // Current user's selected challenges
  const [myProblemIds, setMyProblemIds] = useState<Set<string>>(new Set());
  const [showMoreChallenges, setShowMoreChallenges] = useState(false);

  // Stable string key for filterChallenges to use in useCallback deps
  const filterChallengesKey = [...filterChallenges].sort().join(",");

  function toggleChallenge(id: string) {
    setFilterChallenges((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data) => {
        if (data.problems) {
          setMyProblemIds(new Set(data.problems.map((p: { id: string }) => p.id)));
        }
        const st = data.district?.state;
        setMyUserState(typeof st === "string" && st.length > 0 ? st : null);
      })
      .catch(() => {});
  }, []);

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), sort });
    if (filterRole) params.set("role", filterRole);
    if (filterChallenges.size > 0) params.set("problemIds", [...filterChallenges].join(","));
    if (filterState) params.set("state", filterState);
    if (filterUrbanicity) params.set("urbanicity", filterUrbanicity);
    if (filterSizeBucket) params.set("sizeBucket", filterSizeBucket);
    if (filterCharter) params.set("charter", filterCharter);

    const res = await fetch(`/api/matches?${params}`);
    const data = await res.json();
    setMatches(data.matches ?? []);
    setTotal(data.total ?? 0);
    setTotalPages(data.totalPages ?? 1);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, filterRole, filterChallengesKey, filterState, filterUrbanicity, filterSizeBucket, filterCharter]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    setPage(1);
  }, [filterRole, filterChallengesKey, filterState, filterUrbanicity, filterSizeBucket, filterCharter]);

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

  const CHARTER_LABELS: Record<string, string> = {
    charter: "Charter district only",
    traditional: "Traditional only",
  };

  const activeFilterCount =
    (filterRole ? 1 : 0) +
    filterChallenges.size +
    (filterState ? 1 : 0) +
    (filterUrbanicity ? 1 : 0) +
    (filterSizeBucket ? 1 : 0) +
    (filterCharter ? 1 : 0);

  const orderedStates = useMemo(() => {
    const codes = US_STATES as readonly string[];
    if (!myUserState) return [...US_STATES];
    if (codes.includes(myUserState)) {
      return [myUserState, ...US_STATES.filter((s) => s !== myUserState)];
    }
    return [myUserState, ...US_STATES];
  }, [myUserState]);

  const challengeBubble = (p: ProblemStatement) => (
    <button
      key={p.id}
      type="button"
      onClick={() => toggleChallenge(p.id)}
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs leading-tight transition-colors cursor-pointer ${
        filterChallenges.has(p.id)
          ? "bg-primary text-primary-foreground border-primary shadow-sm"
          : "bg-background text-foreground border-border hover:bg-accent hover:border-accent-foreground/20"
      }`}
    >
      {p.label}
    </button>
  );

  const filterContent = (
    <div className="space-y-5">
      {/* Sort */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Sort by
        </label>
        <Select value={sort} onValueChange={(v) => v && setSort(v)}>
          <SelectTrigger className="text-xs">
            <SelectValue>{(v: string) => SORT_LABELS[v] ?? v}</SelectValue>
          </SelectTrigger>
          <SelectContent className="[&_[data-slot=select-item]]:text-xs">
            <SelectItem value="score">Match score</SelectItem>
            <SelectItem value="recent">Recently active</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border" />

      {/* Challenges */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <label className="text-sm font-medium text-muted-foreground">
            Challenges
          </label>
          {filterChallenges.size > 0 && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {filterChallenges.size}
            </Badge>
          )}
        </div>
        {myProblemIds.size > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground/70">
              My challenges
            </p>
            <div className="flex flex-wrap gap-1.5">
              {problems.filter((p) => myProblemIds.has(p.id)).map(challengeBubble)}
            </div>
          </div>
        )}
        {problems.some((p) => !myProblemIds.has(p.id)) && (
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setShowMoreChallenges((v) => !v)}
              className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground/70 hover:text-foreground transition-colors mb-2"
            >
              <ChevronDown
                className={`size-3 transition-transform duration-200 ${showMoreChallenges ? "rotate-180" : ""}`}
              />
              More challenges
            </button>
            {showMoreChallenges && (
              <div className="flex flex-wrap gap-1.5 animate-in fade-in-0 slide-in-from-top-1 duration-200">
                {problems.filter((p) => !myProblemIds.has(p.id)).map(challengeBubble)}
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="border-border" />

      {/* People */}
      <div>
        <label className="text-sm font-medium text-muted-foreground mb-2 block">
          Role
        </label>
        <Select value={filterRole} onValueChange={(v) => setFilterRole(v ?? "")}>
          <SelectTrigger className="text-xs">
            <SelectValue placeholder="All roles">
              {(v: string) => ROLE_LABELS[v] ?? "All roles"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent className="[&_[data-slot=select-item]]:text-xs">
            <SelectItem value="">All roles</SelectItem>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <hr className="border-border" />

      {/* District */}
      <div className="space-y-3">
        <label className="text-sm font-medium text-muted-foreground block">
          District
        </label>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">State</label>
          <Select value={filterState} onValueChange={(v) => setFilterState(v ?? "")}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="All states">
                {(v: string) => v || "All states"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="[&_[data-slot=select-item]]:text-xs">
              <SelectItem value="">All states</SelectItem>
              {orderedStates.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Type</label>
          <Select value={filterUrbanicity} onValueChange={(v) => setFilterUrbanicity(v ?? "")}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="All types">
                {(v: string) => URBANICITY_LABELS[v] ?? "All types"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="[&_[data-slot=select-item]]:text-xs">
              <SelectItem value="">All types</SelectItem>
              <SelectItem value="urban">Urban</SelectItem>
              <SelectItem value="suburban">Suburban</SelectItem>
              <SelectItem value="town">Town</SelectItem>
              <SelectItem value="rural">Rural</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Size</label>
          <Select value={filterSizeBucket} onValueChange={(v) => setFilterSizeBucket(v ?? "")}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="All sizes">
                {(v: string) => SIZE_LABELS[v] ?? "All sizes"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="[&_[data-slot=select-item]]:text-xs">
              <SelectItem value="">All sizes</SelectItem>
              <SelectItem value="small">Small (&lt;3K)</SelectItem>
              <SelectItem value="medium">Medium (3K-15K)</SelectItem>
              <SelectItem value="large">Large (15K-50K)</SelectItem>
              <SelectItem value="very_large">Very Large (50K+)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm text-muted-foreground mb-1 block">Charter</label>
          <Select value={filterCharter} onValueChange={(v) => setFilterCharter(v ?? "")}>
            <SelectTrigger className="text-xs">
              <SelectValue placeholder="All">
                {(v: string) => CHARTER_LABELS[v] ?? "All"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent className="[&_[data-slot=select-item]]:text-xs">
              <SelectItem value="">All</SelectItem>
              <SelectItem value="charter">Charter only</SelectItem>
              <SelectItem value="traditional">Traditional only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Clear */}
      {activeFilterCount > 0 && (
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full text-xs"
            onClick={() => {
              setFilterRole("");
              setFilterChallenges(new Set());
              setFilterState("");
              setFilterUrbanicity("");
              setFilterSizeBucket("");
              setFilterCharter("");
            }}
          >
            Clear all filters ({activeFilterCount})
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex gap-6">
      {/* Desktop filter sidebar: own scroll so long filters don’t grow the page */}
      <aside className="hidden lg:block w-72 shrink-0 self-start lg:sticky lg:top-20">
        <div className="flex max-h-[calc(100dvh-5.5rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <h2 className="shrink-0 border-b border-border/80 px-5 pt-5 pb-3 text-sm font-semibold">
            Filters
          </h2>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 py-4">
            {filterContent}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Discover Matches</h1>
            <p className="text-muted-foreground text-xs mt-1">
              {loading ? "Finding matches..." : `${total} peers found`}
            </p>
          </div>
          {/* Mobile filter button */}
          <Sheet open={mobileFilterOpen} onOpenChange={setMobileFilterOpen}>
            <SheetTrigger
              render={(props) => (
                <Button variant="outline" size="sm" className="lg:hidden gap-1.5 text-xs" {...props}>
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              )}
            />
            <SheetContent side="bottom" className="h-[80vh] rounded-t-xl">
              <SheetTitle className="text-sm font-semibold">Filters</SheetTitle>
              <div className="mt-4 overflow-y-auto max-h-[calc(80vh-8rem)]">{filterContent}</div>
              <Button
                className="w-full mt-4 text-xs"
                onClick={() => setMobileFilterOpen(false)}
              >
                Apply filters
              </Button>
            </SheetContent>
          </Sheet>
        </div>

        {loading ? (
          <div className="grid gap-3 md:grid-cols-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <MatchCardSkeleton key={i} />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <EmptyState
              title="No matches yet"
              description="We couldn't find peers matching your profile right now. Try adjusting your filters, or check back as more members join."
              action={
                <Link href="/profile">
                  <Button variant="outline" size="sm" className="text-xs">
                    Update your challenges
                  </Button>
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2">
              {matches.map((match) => (
                <Link
                  key={match.user.id}
                  href={`/profile/${match.user.id}`}
                >
                  <div className="group rounded-xl border border-border bg-card p-4 shadow-sm hover:shadow-md hover:border-border/80 transition-all h-full">
                    {/* Header */}
                    <div className="flex items-start gap-3 mb-3">
                      <UserAvatar name={match.user.name} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold truncate group-hover:text-primary transition-colors">
                            {match.user.name}
                          </h3>
                          <span className="shrink-0 inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[11px] font-semibold">
                            {match.score}%
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {match.user.role
                            ? ROLE_LABELS[match.user.role] ?? match.user.role
                            : "Member"}
                        </p>
                        {match.district && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                            {match.district.name}, {match.district.state}
                            {match.district.isCharterAgency === true && " · Charter"}
                            {match.district.totalEnrollment &&
                              ` · ${match.district.totalEnrollment.toLocaleString()} students`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-muted-foreground mb-2.5">
                      {buildMatchSummary(match)}
                    </p>

                    {/* Shared challenge bubbles */}
                    {match.sharedProblems.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2.5">
                        {match.sharedProblems.map((pid) => (
                          <span
                            key={pid}
                            className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[11px] leading-tight text-foreground"
                          >
                            {problemMap[pid] ?? "Shared challenge"}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Activity */}
                    <div className="flex items-center pt-2 border-t border-border/50">
                      <span className="text-[11px] text-muted-foreground/60">
                        {getActivityLabel(match.user.lastActiveAt)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
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
