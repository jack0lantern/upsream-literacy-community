import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

const ADMIN_NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/flagged", label: "Flagged" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/keywords", label: "Keywords" },
  { href: "/admin/problems", label: "Problems" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const isAdmin = (session.user as { isAdmin?: boolean }).isAdmin;
  if (!isAdmin) redirect("/dashboard");

  const pendingReportsCount = await db.report.count({ where: { status: "pending" } });

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-background sticky top-0 z-50">
        <div className="container mx-auto px-4 max-w-7xl flex h-14 items-center gap-6">
          <Link href="/dashboard" className="font-semibold text-lg">
            Upstream
          </Link>
          <span className="text-sm text-muted-foreground border px-2 py-0.5 rounded">
            Admin
          </span>
          <nav className="flex items-center gap-1" aria-label="Admin">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-2 text-sm rounded-md text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors flex items-center gap-1.5"
              >
                {item.label}
                {item.href === "/admin/reports" && pendingReportsCount > 0 && (
                  <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4">
                    {pendingReportsCount}
                  </Badge>
                )}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <div className="container mx-auto px-4 py-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
