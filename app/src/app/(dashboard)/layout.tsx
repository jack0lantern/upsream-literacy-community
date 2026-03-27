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
      {!user.emailVerified && <EmailVerificationBanner />}
      <DashboardNav user={session.user} />
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
