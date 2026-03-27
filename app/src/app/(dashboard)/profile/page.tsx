"use client";

import { useState, useEffect } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/user-avatar";
import { ProfileSkeleton } from "@/components/loading-skeleton";

const ROLE_LABELS: Record<string, string> = {
  literacy_director: "Literacy Director / CAO",
  curriculum_coordinator: "Curriculum & Instruction Coordinator",
  literacy_coach: "District Literacy Coach",
  mtss_coordinator: "MTSS / RTI Coordinator",
  other: "Other",
};

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string | null;
  bio: string | null;
  onboarded: boolean;
  district: {
    name: string;
    state: string;
    urbanicity: string | null;
    totalEnrollment: number | null;
    frlPct: number | null;
    ellPct: number | null;
  } | null;
  problems: { id: string; label: string; category: string }[];
}

interface ProblemStatement {
  id: string;
  label: string;
  category: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allProblems, setAllProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/problems").then((r) => r.json()),
    ]).then(([profileData, problemsData]) => {
      setProfile(profileData);
      setAllProblems(problemsData);
      setBio(profileData.bio ?? "");
      setSelectedProblemIds(profileData.problems?.map((p: { id: string }) => p.id) ?? []);
      setLoading(false);
    });
  }, []);

  function toggleProblem(id: string) {
    setSelectedProblemIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < 5
          ? [...prev, id]
          : prev
    );
  }

  async function handleSave() {
    setSaving(true);
    await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bio, problemIds: selectedProblemIds }),
    });
    const updated = await fetch("/api/profile").then((r) => r.json());
    setProfile(updated);
    setEditing(false);
    setSaving(false);
  }

  async function handleDeactivate() {
    await fetch("/api/profile", { method: "DELETE" });
    signOut({ callbackUrl: "/login" });
  }

  if (loading) return <ProfileSkeleton />;
  if (!profile) return null;

  const problemsByCategory = allProblems.reduce(
    (acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    },
    {} as Record<string, ProblemStatement[]>
  );

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <UserAvatar name={profile.name} size="lg" />
            <div>
              <CardTitle>{profile.name}</CardTitle>
              <CardDescription>
                {profile.role ? ROLE_LABELS[profile.role] ?? profile.role : ""}{" "}
                {profile.district && (
                  <>
                    at {profile.district.name}, {profile.district.state}
                  </>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile.district && (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">
                Type: {profile.district.urbanicity ?? "Unknown"}
              </span>
              <span className="text-muted-foreground">
                Size:{" "}
                {profile.district.totalEnrollment?.toLocaleString() ??
                  "Unknown"}{" "}
                students
              </span>
              <span className="text-muted-foreground">
                FRL:{" "}
                {profile.district.frlPct != null
                  ? `${profile.district.frlPct.toFixed(1)}%`
                  : "Unknown"}
              </span>
              <span className="text-muted-foreground">
                ELL:{" "}
                {profile.district.ellPct != null
                  ? `${profile.district.ellPct.toFixed(1)}%`
                  : "Unknown"}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">About</CardTitle>
          {!editing && (
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Bio</label>
                <Textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="What literacy challenge are you most focused on right now?"
                  maxLength={280}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground mt-1 text-right">
                  {bio.length}/280
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Challenges ({selectedProblemIds.length}/5)
                </label>
                <div className="space-y-4 max-h-64 overflow-y-auto">
                  {Object.entries(problemsByCategory).map(([cat, items]) => (
                    <div key={cat}>
                      <p className="text-xs text-muted-foreground mb-1">
                        {cat}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {items.map((p) => (
                          <Badge
                            key={p.id}
                            variant={
                              selectedProblemIds.includes(p.id)
                                ? "default"
                                : "outline"
                            }
                            className="cursor-pointer"
                            onClick={() => toggleProblem(p.id)}
                          >
                            {p.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving || selectedProblemIds.length === 0}>
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm">
                {profile.bio || (
                  <span className="text-muted-foreground italic">
                    No bio yet
                  </span>
                )}
              </p>
              <div>
                <p className="text-sm font-medium mb-2">Challenges</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.problems.map((p) => (
                    <Badge key={p.id} variant="secondary">
                      {p.label}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{profile.email}</p>
          <Dialog>
            <DialogTrigger
              render={(props) => <Button variant="destructive" size="sm" {...props}>Deactivate account</Button>}
            />
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deactivate your account?</DialogTitle>
                <DialogDescription>
                  Your profile will be hidden from matches and you&apos;ll be
                  signed out. You can contact support to reactivate later.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="destructive" onClick={handleDeactivate}>
                  Deactivate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </div>
  );
}
