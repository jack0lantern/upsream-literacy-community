"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { use } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface AdminMessage {
  id: string;
  body: string;
  sentAt: string;
  flagged: boolean;
  deletedAt: string | null;
  sender: { id: string; name: string };
}

interface ConversationDetail {
  id: string;
  status: string;
  members: {
    user: { id: string; name: string; email: string; status: string };
  }[];
  messages: AdminMessage[];
}

export default function FlaggedConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [conversation, setConversation] = useState<ConversationDetail | null>(null);

  useEffect(() => {
    fetch(`/api/admin/flagged/${id}`)
      .then((r) => r.json())
      .then(setConversation);
  }, [id]);

  async function handleAction(action: string, extra?: Record<string, string>) {
    await fetch(`/api/admin/flagged/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...extra }),
    });

    // Refresh
    const res = await fetch(`/api/admin/flagged/${id}`);
    setConversation(await res.json());
  }

  if (!conversation) {
    return <div className="animate-pulse h-64 bg-muted rounded-lg" />;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Conversation Review</h1>
          <p className="text-sm text-muted-foreground">
            {conversation.members.map((m) => m.user.name).join(" & ")}
          </p>
        </div>
        <Badge
          variant={
            conversation.status === "flagged" ? "destructive" : "secondary"
          }
        >
          {conversation.status}
        </Badge>
      </div>

      {/* Participant info */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {conversation.members.map((m) => (
          <div key={m.user.id} className="border rounded-lg p-3">
            <p className="font-medium text-sm">{m.user.name}</p>
            <p className="text-xs text-muted-foreground">{m.user.email}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                {m.user.status}
              </Badge>
              {m.user.status === "active" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs"
                  onClick={() =>
                    handleAction("suspend_user", { userId: m.user.id })
                  }
                >
                  Suspend
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Messages */}
      <div className="border rounded-lg divide-y mb-6">
        {conversation.messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "p-3",
              msg.deletedAt && "opacity-50",
              msg.flagged && "bg-destructive/5"
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{msg.sender.name}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(msg.sentAt).toLocaleString()}
                </span>
                {msg.flagged && (
                  <Badge variant="destructive" className="text-xs">
                    keyword match
                  </Badge>
                )}
              </div>
              {!msg.deletedAt && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-destructive"
                  onClick={() =>
                    handleAction("delete_message", { messageId: msg.id })
                  }
                >
                  Delete
                </Button>
              )}
            </div>
            <p className="text-sm mt-1">
              {msg.deletedAt ? (
                <span className="italic text-muted-foreground">
                  Message deleted
                </span>
              ) : (
                msg.body
              )}
            </p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {conversation.status === "flagged" && (
          <>
            <Button onClick={() => handleAction("resolve")}>
              Mark as Resolved
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleAction("close")}
            >
              Close Conversation
            </Button>
          </>
        )}
        <Button variant="outline" onClick={() => router.push("/admin/flagged")}>
          Back
        </Button>
      </div>
    </div>
  );
}
