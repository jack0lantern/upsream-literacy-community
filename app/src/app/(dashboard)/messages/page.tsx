"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
  useSearchParams(); // keep searchParams in scope for future use
  const [conversations, setConversations] = useState<ConversationPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"messages" | "requests">("messages");
  const [requests, setRequests] = useState<ConversationPreview[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((data) => {
        setConversations(Array.isArray(data) ? data : []);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetch("/api/conversations?type=requests")
      .then((r) => r.json())
      .then((data) => {
        setRequests(Array.isArray(data) ? data : []);
        setRequestsLoading(false);
      });
  }, []);

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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Messages</h1>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b mb-4">
        <button
          onClick={() => setTab("messages")}
          className={cn(
            "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "messages"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Messages
        </button>
        <button
          onClick={() => setTab("requests")}
          className={cn(
            "flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "requests"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Requests
          {requests.length > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {requests.length}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      {tab === "messages" ? (
        conversations.length === 0 ? (
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
                    <span className={cn("text-sm truncate", conv.hasUnread ? "font-semibold" : "font-medium")}>
                      {conv.otherUser?.name ?? "Unknown"}
                    </span>
                    {conv.lastMessage && (
                      <span className="text-xs text-muted-foreground shrink-0">
                        {formatTime(conv.lastMessage.sentAt)}
                      </span>
                    )}
                  </div>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate">{conv.lastMessage.body}</p>
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
        )
      ) : (
        requestsLoading ? (
          <ConversationListSkeleton />
        ) : requests.length === 0 ? (
          <EmptyState
            title="No pending requests"
            description="Message requests from other members will appear here."
          />
        ) : (
          <div className="border rounded-lg divide-y">
            {requests.map((conv) => (
              <Link
                key={conv.id}
                href={`/messages/${conv.id}`}
                className="flex items-center gap-3 p-4 hover:bg-accent/50 transition-colors"
              >
                <UserAvatar name={conv.otherUser?.name ?? "?"} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {conv.otherUser?.name ?? "Unknown"}
                  </p>
                  {conv.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate">
                      {conv.lastMessage.body}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
