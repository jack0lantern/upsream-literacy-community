"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/empty-state";

interface FlaggedConversation {
  id: string;
  status: string;
  participants: {
    id: string;
    name: string;
    email: string;
    status: string;
  }[];
  lastMessage: { body: string; sentAt: string } | null;
  createdAt: string;
}

export default function FlaggedPage() {
  const [conversations, setConversations] = useState<FlaggedConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/flagged")
      .then((r) => r.json())
      .then((data) => {
        setConversations(data);
        setLoading(false);
      });
  }, []);

  if (!loading && conversations.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-bold mb-6">Flagged Conversations</h1>
        <EmptyState
          title="No flagged conversations"
          description="Conversations flagged by users or keyword alerts will appear here."
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Flagged Conversations</h1>
      <div className="border rounded-lg divide-y">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-4">
                <div className="h-4 w-48 bg-muted rounded animate-pulse" />
              </div>
            ))
          : conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/admin/flagged/${conv.id}`}
                className="block p-4 hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">
                      {conv.participants.map((p) => p.name).join(" & ")}
                    </p>
                    {conv.lastMessage && (
                      <p className="text-xs text-muted-foreground mt-1 truncate max-w-md">
                        {conv.lastMessage.body}
                      </p>
                    )}
                  </div>
                  <Badge variant="destructive">Flagged</Badge>
                </div>
              </Link>
            ))}
      </div>
    </div>
  );
}
