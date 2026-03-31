"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function OnboardingReminderBanner({ show }: { show: boolean }) {
  const pathname = usePathname();

  if (!show) return null;
  if (pathname === "/onboarding" || pathname.startsWith("/onboarding/")) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-sky-50 border-b border-sky-200 px-4 py-2.5 text-sm text-sky-900 dark:bg-sky-950/50 dark:border-sky-800 dark:text-sky-100"
    >
      <div className="container mx-auto max-w-7xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="min-w-0">
          Finish onboarding to set your district, role, and literacy focus areas so
          we can show relevant peer matches.
        </p>
        <Link
          href="/onboarding"
          className="shrink-0 font-semibold text-sky-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:text-sky-200"
        >
          Finish onboarding
        </Link>
      </div>
    </div>
  );
}
