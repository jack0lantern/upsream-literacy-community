"use client";

import { useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface District {
  id: string;
  name: string;
  state: string;
  urbanicity: string | null;
  totalEnrollment: number | null;
}

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [districtQuery, setDistrictQuery] = useState("");
  const [districtResults, setDistrictResults] = useState<District[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<District | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const searchDistricts = useCallback(async (q: string) => {
    if (q.length < 2) {
      setDistrictResults([]);
      return;
    }
    const res = await fetch(`/api/districts/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setDistrictResults(data);
  }, []);

  useEffect(() => {
    if (selectedDistrict) return;
    const timeout = setTimeout(() => {
      searchDistricts(districtQuery);
    }, 300);
    return () => clearTimeout(timeout);
  }, [districtQuery, searchDistricts, selectedDistrict]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          districtId: selectedDistrict?.id,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setLoading(false);
        return;
      }

      // Auto sign-in after signup
      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (signInResult?.error) {
        router.push("/login");
        return;
      }

      router.push("/onboarding");
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          Join Upstream Literacy Community to connect with peers
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div
              className="bg-destructive/10 text-destructive text-sm p-3 rounded-md"
              role="alert"
            >
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Maria Rodriguez"
              required
              autoComplete="name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@district.edu"
              required
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">District</Label>
            <div className="relative">
              <Input
                id="district"
                value={selectedDistrict ? selectedDistrict.name : districtQuery}
                onChange={(e) => {
                  setDistrictQuery(e.target.value);
                  setSelectedDistrict(null);
                }}
                placeholder="Search for your district..."
                autoComplete="off"
              />
              {selectedDistrict && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDistrict(null);
                    setDistrictQuery("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-sm"
                  aria-label="Clear district"
                >
                  &times;
                </button>
              )}
            </div>
            {districtResults.length > 0 && !selectedDistrict && (
              <div className="border rounded-md divide-y max-h-48 overflow-y-auto">
                {districtResults.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      setSelectedDistrict(d);
                      setDistrictQuery("");
                      setDistrictResults([]);
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
            <p className="text-xs text-muted-foreground">
              Optional — you can also set this during onboarding.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-foreground hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
