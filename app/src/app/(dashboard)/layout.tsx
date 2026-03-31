import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { DashboardNav } from "@/components/dashboard-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";
import { OnboardingReminderBanner } from "@/components/onboarding-reminder-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const user = session.user;

  // Read onboarded from DB so the banner updates right after onboarding completes
  // (JWT session is not refreshed by router.refresh()).
  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    select: { onboarded: true },
  });
  const onboarded = dbUser?.onboarded ?? user.onboarded;

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      {!user.emailVerified && <EmailVerificationBanner />}
      <OnboardingReminderBanner show={!onboarded} />
      <DashboardNav user={session.user} />
      <main id="main-content" className="flex-1">
        <div className="container mx-auto px-4 py-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
