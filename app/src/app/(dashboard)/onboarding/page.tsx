"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { US_STATES } from "@/lib/us-states";
import { Search } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  literacy_director: "Literacy Director / CAO",
  curriculum_coordinator: "Curriculum & Instruction Coordinator",
  literacy_coach: "District Literacy Coach",
  mtss_coordinator: "MTSS / RTI Coordinator",
  other: "Other",
};

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

const STATE_FILTER_ALL = "__all__";

const STEPS = [
  "Find District",
  "Your Role",
  "Challenges",
  "Bio",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [selectedState, setSelectedState] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [districtResults, setDistrictResults] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [districtFocused, setDistrictFocused] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualDistrict, setManualDistrict] = useState({
    name: "",
    totalEnrollment: "",
  });
  const [role, setRole] = useState("");
  const [problems, setProblems] = useState<ProblemStatement[]>([]);
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [bio, setBio] = useState("");

  // Fetch problem statements
  useEffect(() => {
    fetch("/api/problems")
      .then((res) => res.json())
      .then(setProblems)
      .catch(() => {});
  }, []);

  // District search
  const searchDistricts = useCallback(async (q: string, state: string) => {
    if (q.length < 2) {
      setDistrictResults([]);
      return;
    }
    const params = new URLSearchParams({ q });
    if (state) params.set("state", state);
    try {
      const res = await fetch(`/api/districts/search?${params}`);
      if (!res.ok) {
        setDistrictResults([]);
        return;
      }
      const data: unknown = await res.json();
      setDistrictResults(Array.isArray(data) ? data : []);
    } catch {
      setDistrictResults([]);
    }
  }, []);

  useEffect(() => {
    if (selectedDistrict) return;
    const timeout = setTimeout(() => {
      searchDistricts(districtQuery, selectedState);
    }, 300);
    return () => clearTimeout(timeout);
  }, [districtQuery, selectedState, searchDistricts, selectedDistrict]);

  function toggleProblem(id: string) {
    setSelectedProblemIds((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < 5
          ? [...prev, id]
          : prev
    );
  }

  async function handleManualDistrictCreate() {
    const res = await fetch("/api/districts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: manualDistrict.name,
        state: selectedState,
        totalEnrollment: manualDistrict.totalEnrollment
          ? parseInt(manualDistrict.totalEnrollment)
          : undefined,
      }),
    });
    if (!res.ok) {
      setError("Failed to create district entry.");
      return;
    }
    const district = await res.json();
    setSelectedDistrict(district);
    setShowManualEntry(false);
    setStep(1);
  }

  async function handleSubmit() {
    if (!selectedDistrict || !role || selectedProblemIds.length === 0) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          districtId: selectedDistrict.id,
          role,
          problemIds: selectedProblemIds,
          bio: bio || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!selectedDistrict;
      case 1:
        return !!role;
      case 2:
        return selectedProblemIds.length >= 1;
      case 3:
        return true;
      default:
        return false;
    }
  };

  // Group problems by category
  const problemsByCategory = problems.reduce(
    (acc, p) => {
      if (!acc[p.category]) acc[p.category] = [];
      acc[p.category].push(p);
      return acc;
    },
    {} as Record<string, ProblemStatement[]>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress stepper */}
      <div className="flex items-center justify-between mb-8">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                  i < step
                    ? "bg-primary text-primary-foreground border-primary"
                    : i === step
                      ? "border-primary text-primary"
                      : "border-muted text-muted-foreground"
                )}
              >
                {i < step ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              <span className="text-xs mt-1 hidden sm:block text-muted-foreground">
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  "h-0.5 w-8 sm:w-16 mx-1",
                  i < step ? "bg-primary" : "bg-muted"
                )}
              />
            )}
          </div>
        ))}
      </div>

      <Card>
        {/* Step 0: District search */}
        {step === 0 && !showManualEntry && (
          <>
            <CardHeader>
              <CardTitle>Find your district</CardTitle>
              <CardDescription>
                Search by district name. We&apos;ll auto-fill demographic data.
                Optionally narrow results by state.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stateFilter" className="text-muted-foreground">
                  State{" "}
                  <span className="font-normal">(optional — skip to search nationwide)</span>
                </Label>
                <Select
                  value={selectedState || STATE_FILTER_ALL}
                  onValueChange={(v) => {
                    if (v == null || v === STATE_FILTER_ALL) {
                      setSelectedState("");
                      return;
                    }
                    setSelectedState(v);
                  }}
                >
                  <SelectTrigger id="stateFilter">
                    <SelectValue placeholder="Any state">
                      {selectedState ? selectedState : "Any state"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={STATE_FILTER_ALL}>Any state</SelectItem>
                    {US_STATES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="district">District</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    id="district"
                    placeholder="Start typing your district name..."
                    value={selectedDistrict ? selectedDistrict.name : districtQuery}
                    onChange={(e) => {
                      setDistrictQuery(e.target.value);
                      setSelectedDistrict(null);
                    }}
                    onFocus={() => setDistrictFocused(true)}
                    onBlur={() =>
                      setTimeout(() => setDistrictFocused(false), 150)
                    }
                    autoComplete="off"
                    className={cn("pl-8", selectedDistrict && "pr-9")}
                    autoFocus
                  />
                  {selectedDistrict && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDistrict(null);
                        setDistrictQuery("");
                        setDistrictResults([]);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                      aria-label="Clear district"
                    >
                      &times;
                    </button>
                  )}
                </div>
                {!selectedDistrict &&
                  districtFocused &&
                  districtResults.length === 0 && (
                    <div className="border rounded-md px-3 py-2 text-sm text-muted-foreground">
                      Type to search across 18,000+ districts
                    </div>
                  )}
                {districtResults.length > 0 && !selectedDistrict && (
                  <div
                    role="listbox"
                    className="border rounded-md divide-y max-h-48 overflow-y-auto"
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {districtResults.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        role="option"
                        onClick={() => {
                          setSelectedDistrict(d);
                          setDistrictQuery("");
                          setDistrictResults([]);
                          const code = d.state?.trim().toUpperCase() ?? "";
                          const states = US_STATES as readonly string[];
                          if (code && states.includes(code)) {
                            setSelectedState(code);
                          }
                        }}
                        className={cn(
                          "w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                        )}
                      >
                        <p className="font-medium text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.state}
                          {d.urbanicity && ` · ${d.urbanicity}`}
                          {d.totalEnrollment &&
                            ` · ${d.totalEnrollment.toLocaleString()} students`}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedDistrict && (
                <div className="bg-muted/50 rounded-md p-4 space-y-2">
                  <p className="font-medium">{selectedDistrict.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                    <span>
                      Type:{" "}
                      {selectedDistrict.urbanicity ?? "Unknown"}
                    </span>
                    <span>
                      Size:{" "}
                      {selectedDistrict.totalEnrollment?.toLocaleString() ??
                        "Unknown"}{" "}
                      students
                    </span>
                    <span>
                      FRL:{" "}
                      {selectedDistrict.frlPct != null
                        ? `${selectedDistrict.frlPct.toFixed(1)}%`
                        : "Unknown"}
                    </span>
                    <span>
                      ELL:{" "}
                      {selectedDistrict.ellPct != null
                        ? `${selectedDistrict.ellPct.toFixed(1)}%`
                        : "Unknown"}
                    </span>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                My district isn&apos;t listed
              </button>
            </CardContent>
          </>
        )}

        {/* Step 0b: Manual district entry */}
        {step === 0 && showManualEntry && (
          <>
            <CardHeader>
              <CardTitle>Enter your district manually</CardTitle>
              <CardDescription>
                We&apos;ll review this entry and fill in demographic data for
                you.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="manualState">State</Label>
                <Select
                  value={selectedState || undefined}
                  onValueChange={(v) => v && setSelectedState(v)}
                >
                  <SelectTrigger id="manualState">
                    <SelectValue placeholder="Select state" />
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
              <div className="space-y-2">
                <Label htmlFor="districtName">District name</Label>
                <Input
                  id="districtName"
                  value={manualDistrict.name}
                  onChange={(e) =>
                    setManualDistrict((d) => ({ ...d, name: e.target.value }))
                  }
                  placeholder="e.g., Springfield School District"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="enrollment">
                  Approximate enrollment{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Input
                  id="enrollment"
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
                  variant="outline"
                  onClick={() => setShowManualEntry(false)}
                >
                  Back to search
                </Button>
                <Button
                  onClick={handleManualDistrictCreate}
                  disabled={!manualDistrict.name || !selectedState}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </>
        )}

        {/* Step 1: Role */}
        {step === 1 && (
          <>
            <CardHeader>
              <CardTitle>What&apos;s your role?</CardTitle>
              <CardDescription>
                This helps us match you with peers in similar positions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setRole(value)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-md border transition-colors",
                      role === value
                        ? "border-primary bg-primary/5"
                        : "hover:bg-accent"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </CardContent>
          </>
        )}

        {/* Step 2: Problem statements */}
        {step === 2 && (
          <>
            <CardHeader>
              <CardTitle>
                What challenges are you working on?
              </CardTitle>
              <CardDescription>
                Select 1-5 challenges. These are the primary basis for finding
                your matches.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                {selectedProblemIds.length}/5 selected
              </p>
              <div className="space-y-6 max-h-96 overflow-y-auto pr-2">
                {Object.entries(problemsByCategory).map(
                  ([category, items]) => (
                    <div key={category}>
                      <h4 className="text-sm font-medium text-muted-foreground mb-2">
                        {category}
                      </h4>
                      <div className="space-y-1">
                        {items.map((p) => (
                          <button
                            key={p.id}
                            onClick={() => toggleProblem(p.id)}
                            disabled={
                              !selectedProblemIds.includes(p.id) &&
                              selectedProblemIds.length >= 5
                            }
                            className={cn(
                              "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                              selectedProblemIds.includes(p.id)
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-accent disabled:opacity-50"
                            )}
                          >
                            {p.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                )}
              </div>
            </CardContent>
          </>
        )}

        {/* Step 3: Bio */}
        {step === 3 && (
          <>
            <CardHeader>
              <CardTitle>Tell peers about yourself</CardTitle>
              <CardDescription>
                A short bio helps others decide to reach out. This is optional
                but recommended.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="What literacy challenge are you most focused on right now?"
                maxLength={280}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-2 text-right">
                {bio.length}/280
              </p>
            </CardContent>
          </>
        )}

        {error && (
          <div className="px-6 pb-2">
            <div
              className="bg-destructive/10 text-destructive text-sm p-3 rounded-md"
              role="alert"
            >
              {error}
            </div>
          </div>
        )}

        {/* Navigation */}
        {!(step === 0 && showManualEntry) && (
          <CardFooter className="flex justify-between">
            <Button
              variant="outline"
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
            >
              Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canProceed()}
              >
                Continue
              </Button>
            ) : (
              <Button onClick={handleSubmit} disabled={loading || !canProceed()}>
                {loading ? "Saving..." : "Complete setup"}
              </Button>
            )}
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
