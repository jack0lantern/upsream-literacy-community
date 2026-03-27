"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/user-avatar";
import { EmptyState } from "@/components/empty-state";
import { ConversationListSkeleton } from "@/components/loading-skeleton";

interface ConversationPreview {
  id: string;
  status: string;
  muted: boolean;
  otherUser: { id: string; name: string; role: string | null; status: string } | null;
  lastMessage: {
    body: string;
    sentAt: string;
    senderId: string;
  } | null;
  hasUnread: boolean;
}

export default function MessagesPage() {
  return (
    <Suspense>
      <MessagesContent />
    </Suspense>
  );
}

function MessagesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newRecipientId = searchParams.get("new");
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        setConversations(data);
        setLoading(false);
      });
  }, []);

  // Auto-create conversation for new message
  useEffect(() => {
    if (!newRecipientId) return;

    fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId: newRecipientId }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.conversationId) {
          router.replace(`/messages/${data.conversationId}`);
        }
      });
  }, [newRecipientId, router]);

  function formatTime(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < 1) {
      return date.toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
    }
    if (diffDays < 7) {
      return date.toLocaleDateString([], { weekday: "short" });
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Messages</h1>
        <ConversationListSkeleton />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Messages</h1>

      {conversations.length === 0 ? (
        <EmptyState
          title="No conversations yet"
          description="Start by messaging one of your top matches. Find peers working on the same challenges as you."
          action={
            <Link href="/dashboard">
              <button className="text-sm text-primary hover:underline">
                Browse your matches
              </button>
            </Link>
          }
        />
      ) : (
        <div className="border rounded-lg divide-y">
          {conversations.map((conv) => (
            <Link
              key={conv.id}
              href={`/messages/${conv.id}`}
              className={cn(
                "flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors",
                conv.hasUnread && "bg-accent/20",
                conv.muted && "opacity-60"
              )}
            >
              <UserAvatar name={conv.otherUser?.name ?? "?"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      "text-sm truncate",
                      conv.hasUnread ? "font-semibold" : "font-medium"
                    )}
                  >
                    {conv.otherUser?.name ?? "Unknown"}
                  </span>
                  {conv.lastMessage && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTime(conv.lastMessage.sentAt)}
                    </span>
                  )}
                </div>
                {conv.lastMessage && (
                  <p className="text-xs text-muted-foreground truncate">
                    {conv.lastMessage.body}
                  </p>
                )}
                {conv.otherUser?.status === "suspended" && (
                  <p className="text-xs text-destructive">Account suspended</p>
                )}
              </div>
              {conv.hasUnread && (
                <div className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
