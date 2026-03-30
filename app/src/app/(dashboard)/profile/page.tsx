"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/us-states";

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
    id: string;
    name: string;
    state: string;
    urbanicity: string | null;
    totalEnrollment: number | null;
    frlPct: number | null;
    ellPct: number | null;
  } | null;
  problems: { id: string; label: string; category: string }[];
}

interface District {
  id: string;
  name: string;
  state: string;
  urbanicity: string | null;
  totalEnrollment: number | null;
  sizeBucket: string | null;
  frlPct: number | null;
  ellPct: number | null;
}

interface ProblemStatement {
  id: string;
  label: string;
  category: string;
}

interface BlockedUserEntry {
  id: string;
  name: string;
  status: string;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allProblems, setAllProblems] = useState<ProblemStatement[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [bio, setBio] = useState("");
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [selectedState, setSelectedState] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [districtResults, setDistrictResults] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDistrict, setManualDistrict] = useState({
    name: "",
    totalEnrollment: "",
  });

  const [blockedUsers, setBlockedUsers] = useState<BlockedUserEntry[]>([]);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const searchDistricts = useCallback(async (q: string, state: string) => {
    if (q.length < 2) {
      setDistrictResults([]);
      return;
    }
    const params = new URLSearchParams({ q });
    if (state) params.set("state", state);
    const res = await fetch(`/api/districts/search?${params}`);
    const data = await res.json();
    setDistrictResults(data);
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/problems").then((r) => r.json()),
      fetch("/api/users/blocked").then(async (r) => {
        if (!r.ok) return { users: [] as BlockedUserEntry[] };
        return r.json() as Promise<{ users?: BlockedUserEntry[] }>;
      }),
    ]).then(([profileData, problemsData, blockedData]) => {
      setProfile(profileData);
      setAllProblems(problemsData);
      setBio(profileData.bio ?? "");
      setSelectedProblemIds(profileData.problems?.map((p: { id: string }) => p.id) ?? []);
      const users = blockedData.users;
      setBlockedUsers(Array.isArray(users) ? users : []);
      setLoading(false);
    });
  }, []);

  async function handleUnblockUser(userId: string) {
    setUnblockingId(userId);
    try {
      const res = await fetch(`/api/users/${userId}/block`, { method: "DELETE" });
      if (res.ok) {
        setBlockedUsers((prev) => prev.filter((u) => u.id !== userId));
      }
    } finally {
      setUnblockingId(null);
    }
  }

  useEffect(() => {
    if (!editing) return;
    const timeout = setTimeout(() => {
      searchDistricts(districtQuery, selectedState);
    }, 300);
    return () => clearTimeout(timeout);
  }, [districtQuery, selectedState, searchDistricts, editing]);

  function beginEditing(nextProfile: Profile) {
    setSaveError("");
    setBio(nextProfile.bio ?? "");
    setSelectedProblemIds(
      nextProfile.problems?.map((p) => p.id) ?? []
    );
    setSelectedState(nextProfile.district?.state ?? "");
    setDistrictQuery(nextProfile.district?.name ?? "");
    setDistrictResults([]);
    setShowManualEntry(false);
    setManualDistrict({ name: "", totalEnrollment: "" });
    if (nextProfile.district?.id) {
      const d = nextProfile.district;
      setSelectedDistrict({
        id: d.id,
        name: d.name,
        state: d.state,
        urbanicity: d.urbanicity,
        totalEnrollment: d.totalEnrollment,
        frlPct: d.frlPct,
        ellPct: d.ellPct,
        sizeBucket: null,
      });
    } else {
      setSelectedDistrict(null);
    }
    setEditing(true);
  }

  function handleStateChange(v: string) {
    setSelectedState(v);
    setSelectedDistrict((prev) => (prev && prev.state !== v ? null : prev));
  }

  async function handleManualDistrictCreate() {
    const res = await fetch("/api/districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: manualDistrict.name,
        state: selectedState,
        totalEnrollment: manualDistrict.totalEnrollment
          ? parseInt(manualDistrict.totalEnrollment, 10)
          : undefined,
      }),
    });
    if (!res.ok) {
      setSaveError("Failed to create district entry.");
      return;
    }
    const district = (await res.json()) as District;
    setSelectedDistrict(district);
    setShowManualEntry(false);
    setDistrictQuery(district.name);
    setDistrictResults([]);
  }

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
    setSaveError("");
    const payload: {
      bio: string;
      problemIds: string[];
      districtId?: string;
    } = { bio, problemIds: selectedProblemIds };
    if (selectedDistrict) {
      payload.districtId = selectedDistrict.id;
    }
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setSaveError(data.error ?? "Failed to save.");
      setSaving(false);
      return;
    }
    const updated = (await fetch("/api/profile").then((r) => r.json())) as Profile;
    setProfile(updated);
    setEditing(false);
    setSaving(false);
  }

  if (loading) return <ProfileSkeleton />;
  if (!profile) return null;

  const districtRequired = profile.district != null;
  const districtOk = !districtRequired || selectedDistrict != null;

  async function handleDeactivate() {
    await fetch("/api/profile", { method: "DELETE" });
    signOut({ callbackUrl: "/login" });
  }

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
            <Button variant="outline" size="sm" onClick={() => beginEditing(profile)}>
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {editing ? (
            <div className="space-y-4">
              <div className="space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">District</p>
                <p className="text-xs text-muted-foreground">
                  State filters search. Pick your district or add it manually if it
                  isn&apos;t listed.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="profile-state">State</Label>
                  <Select
                    value={selectedState || undefined}
                    onValueChange={(v) => v && handleStateChange(v)}
                  >
                    <SelectTrigger id="profile-state">
                      <SelectValue placeholder="Select your state" />
                    </SelectTrigger>
                    <SelectContent>
                      {US_STATES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!showManualEntry && (
                  <div className="space-y-2">
                    <Label htmlFor="profile-district-search">Find district</Label>
                    <Input
                      id="profile-district-search"
                      placeholder="Start typing your district name..."
                      value={districtQuery}
                      onChange={(e) => setDistrictQuery(e.target.value)}
                      disabled={!selectedState}
                    />
                    {!selectedState && (
                      <p className="text-xs text-muted-foreground">
                        Select a state first to search.
                      </p>
                    )}
                    {districtResults.length > 0 && (
                      <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                        {districtResults.map((d) => (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => {
                              setSelectedDistrict(d);
                              setDistrictQuery(d.name);
                              setDistrictResults([]);
                            }}
                            className={cn(
                              "w-full text-left px-3 py-2.5 hover:bg-accent transition-colors",
                              selectedDistrict?.id === d.id && "bg-accent"
                            )}
                          >
                            <p className="font-medium text-sm">{d.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {d.state}
                              {d.urbanicity && ` · ${d.urbanicity}`}
                              {d.totalEnrollment != null &&
                                ` · ${d.totalEnrollment.toLocaleString()} students`}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                    {selectedDistrict && (
                      <div className="bg-muted/50 rounded-md p-3 space-y-1 text-sm">
                        <p className="font-medium">{selectedDistrict.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {selectedDistrict.state}
                        </p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowManualEntry(true)}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                      disabled={!selectedState}
                    >
                      My district isn&apos;t listed
                    </button>
                  </div>
                )}
                {showManualEntry && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="manual-district-name">District name</Label>
                      <Input
                        id="manual-district-name"
                        value={manualDistrict.name}
                        onChange={(e) =>
                          setManualDistrict((d) => ({ ...d, name: e.target.value }))
                        }
                        placeholder="e.g., Springfield School District"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="manual-enrollment">
                        Approximate enrollment{" "}
                        <span className="text-muted-foreground font-normal">
                          (optional)
                        </span>
                      </Label>
                      <Input
                        id="manual-enrollment"
                        type="number"
                        value={manualDistrict.totalEnrollment}
                        onChange={(e) =>
                          setManualDistrict((d) => ({
                            ...d,
                            totalEnrollment: e.target.value,
                          }))
                        }
                        placeholder="e.g., 5000"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManualEntry(false)}
                      >
                        Back to search
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleManualDistrictCreate()}
                        disabled={!manualDistrict.name || !selectedState}
                      >
                        Use this district
                      </Button>
                    </div>
                  </div>
                )}
                {districtRequired && !selectedDistrict && (
                  <p className="text-xs text-destructive">
                    Select a district to save (required if you already had one, or
                    after changing state).
                  </p>
                )}
              </div>

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

              {saveError && (
                <div
                  className="bg-destructive/10 text-destructive text-sm p-3 rounded-md"
                  role="alert"
                >
                  {saveError}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => void handleSave()}
                  disabled={
                    saving ||
                    selectedProblemIds.length === 0 ||
                    !districtOk
                  }
                >
                  {saving ? "Saving..." : "Save changes"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setSaveError("");
                  }}
                >
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
          <CardTitle className="text-lg">Blocked people</CardTitle>
          <CardDescription>
            You won&apos;t appear in each other&apos;s messaging until you
            unblock.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {blockedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              You&apos;re not blocking anyone.
            </p>
          ) : (
            <ul className="space-y-3">
              {blockedUsers.map((u) => (
                <li
                  key={u.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <UserAvatar name={u.name} size="sm" />
                    <div className="min-w-0">
                      <Link
                        href={`/profile/${u.id}`}
                        className="text-sm font-medium hover:underline truncate block max-w-[12rem] sm:max-w-xs"
                      >
                        {u.name}
                      </Link>
                      {u.status !== "active" && (
                        <p className="text-xs text-muted-foreground">
                          Account unavailable
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleUnblockUser(u.id)}
                    disabled={unblockingId === u.id}
                  >
                    {unblockingId === u.id ? "Unblocking…" : "Unblock"}
                  </Button>
                </li>
              ))}
            </ul>
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
