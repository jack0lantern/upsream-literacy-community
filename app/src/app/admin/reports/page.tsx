"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface Report {
  id: string;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { id: string; name: string };
  reportedUser: { id: string; name: string };
  message: { id: string; body: string; conversationId: string };
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/reports?status=pending")
      .then((r) => r.json())
      .then((data) => {
        setReports(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  async function handleAction(reportId: string, action: "dismiss" | "suspend") {
    const res = await fetch(`/api/admin/reports/${reportId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      setReports((prev) => prev.filter((r) => r.id !== reportId));
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-6">Reports</h1>
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>
      {reports.length === 0 ? (
        <p className="text-muted-foreground">No pending reports.</p>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium">{report.reporter.name}</span>
                    {" reported "}
                    <span className="font-medium">{report.reportedUser.name}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(report.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant="outline">pending</Badge>
              </div>
              <div className="bg-muted rounded p-2 text-sm">
                <p className="text-xs text-muted-foreground mb-1">Reported message:</p>
                <p className="truncate">{report.message.body}</p>
              </div>
              <div className="text-sm">
                <p className="text-xs text-muted-foreground mb-1">Reason:</p>
                <p>{report.reason}</p>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Link
                  href={`/messages/${report.message.conversationId}`}
                  className="text-xs text-primary hover:underline"
                >
                  View conversation
                </Link>
                <div className="flex gap-2 ml-auto">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAction(report.id, "dismiss")}
                  >
                    Dismiss
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(report.id, "suspend")}
                  >
                    Suspend user
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
