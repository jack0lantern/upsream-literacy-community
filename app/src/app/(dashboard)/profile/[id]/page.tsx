import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/user-avatar";

const ROLE_LABELS: Record<string, string> = {
  literacy_director: "Literacy Director / CAO",
  curriculum_coordinator: "Curriculum & Instruction Coordinator",
  literacy_coach: "District Literacy Coach",
  mtss_coordinator: "MTSS / RTI Coordinator",
  other: "Other",
};

function getActivityLabel(lastActiveAt: Date | null): string {
  if (!lastActiveAt) return "New member";
  const diff = Date.now() - lastActiveAt.getTime();
  const days = diff / (1000 * 60 * 60 * 24);
  if (days < 1) return "Active today";
  if (days < 7) return "Active this week";
  if (days < 30) return "Active this month";
  return "Inactive";
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  const user = await db.user.findUnique({
    where: { id, status: "active" },
    include: {
      district: true,
      problems: { include: { problem: true } },
    },
  });

  if (!user || !user.onboarded) notFound();

  // Check if conversation already exists
  let existingConversationId: string | null = null;
  if (session?.user?.id && session.user.id !== id) {
    const existing = await db.conversationMember.findFirst({
      where: {
        userId: session.user.id,
        conversation: {
          members: { some: { userId: id } },
        },
      },
      select: { conversationId: true },
    });
    existingConversationId = existing?.conversationId ?? null;
  }

  // Get shared problems with current user
  let sharedProblemIds: string[] = [];
  if (session?.user?.id) {
    const myProblems = await db.userProblem.findMany({
      where: { userId: session.user.id },
      select: { problemId: true },
    });
    const myProblemIdSet = new Set(myProblems.map((p) => p.problemId));
    sharedProblemIds = user.problems
      .filter((up) => myProblemIdSet.has(up.problemId))
      .map((up) => up.problemId);
  }

  const isOwnProfile = session?.user?.id === id;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <UserAvatar name={user.name} size="lg" />
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{user.name}</h1>
              <p className="text-muted-foreground">
                {user.role ? ROLE_LABELS[user.role] ?? user.role : "Member"}
              </p>
              {user.district && (
                <p className="text-sm text-muted-foreground">
                  {user.district.name}, {user.district.state}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {getActivityLabel(user.lastActiveAt)}
              </p>
            </div>
            {!isOwnProfile && (
              <div>
                {existingConversationId ? (
                  <Link href={`/messages/${existingConversationId}`}>
                    <Button>View Conversation</Button>
                  </Link>
                ) : (
                  <Link href={`/messages?new=${id}`}>
                    <Button>Send Message</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>

      {user.bio && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">About</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{user.bio}</p>
          </CardContent>
        </Card>
      )}

      {user.district && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">District</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-muted-foreground">Type</span>
                <p className="font-medium capitalize">
                  {user.district.urbanicity ?? "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Enrollment</span>
                <p className="font-medium">
                  {user.district.totalEnrollment?.toLocaleString() ?? "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  Free/Reduced Lunch
                </span>
                <p className="font-medium">
                  {user.district.frlPct != null
                    ? `${user.district.frlPct.toFixed(1)}%`
                    : "Unknown"}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">
                  English Learners
                </span>
                <p className="font-medium">
                  {user.district.ellPct != null
                    ? `${user.district.ellPct.toFixed(1)}%`
                    : "Unknown"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Challenges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isOwnProfile && sharedProblemIds.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Shared with you
              </p>
              <div className="flex flex-wrap gap-2">
                {user.problems
                  .filter((up) => sharedProblemIds.includes(up.problemId))
                  .map((up) => (
                    <Badge
                      key={up.problemId}
                      variant="default"
                      className="gap-1"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 16 16"
                        fill="currentColor"
                        className="size-3"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.416 3.376a.75.75 0 0 1 .208 1.04l-5 7.5a.75.75 0 0 1-1.154.114l-3-3a.75.75 0 0 1 1.06-1.06l2.353 2.353 4.493-6.74a.75.75 0 0 1 1.04-.207Z"
                          clipRule="evenodd"
                        />
                      </svg>
                      {up.problem.label}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
          {(() => {
            const other = user.problems.filter(
              (up) => isOwnProfile || !sharedProblemIds.includes(up.problemId)
            );
            if (other.length === 0) return null;
            return (
              <div>
                {!isOwnProfile && sharedProblemIds.length > 0 && (
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Other challenges
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {other.map((up) => (
                    <Badge key={up.problemId} variant="secondary">
                      {up.problem.label}
                    </Badge>
                  ))}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
