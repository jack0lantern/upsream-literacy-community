import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { DashboardNav } from "@/components/dashboard-nav";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  // Redirect to onboarding if profile not complete
  // (but allow access to onboarding page itself)
  const user = session.user as {
    id: string;
    onboarded?: boolean;
    emailVerified?: boolean;
    isAdmin?: boolean;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-blue-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
      >
        Skip to main content
      </a>
      {!user.emailVerified && <EmailVerificationBanner />}
      <DashboardNav user={session.user} />
      <main id="main-content" className="flex-1">
        <div className="container mx-auto px-4 py-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
