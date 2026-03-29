"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UserAvatar } from "@/components/user-avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { use } from "react";

interface Message {
  id: string;
  body: string;
  sentAt: string;
  readAt: string | null;
  sender: { id: string; name: string };
}

interface ConversationInfo {
  id: string;
  otherUser: { id: string; name: string; role: string | null; status: string } | null;
  muted: boolean;
  status: string;
}

export default function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportMessageReason, setReportMessageReason] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user ID
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => setCurrentUserId(data.id));
  }, []);

  // Fetch conversation info
  useEffect(() => {
    fetch("/api/conversations")
      .then((r) => r.json())
      .then((conversations: ConversationInfo[]) => {
        const conv = conversations.find((c: ConversationInfo) => c.id === id);
        if (conv) setConversationInfo(conv);
      });
  }, [id]);

  // Fetch messages and poll
  const fetchMessages = useCallback(
    async (since?: string) => {
      const params = since ? `?since=${encodeURIComponent(since)}` : "";
      const res = await fetch(`/api/conversations/${id}/messages${params}`);
      if (!res.ok) return;
      const data = await res.json();

      if (since) {
        setMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const newMsgs = data.filter((m: Message) => !existingIds.has(m.id));
          return newMsgs.length > 0 ? [...prev, ...newMsgs] : prev;
        });
      } else {
        setMessages(data);
      }
    },
    [id]
  );

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Poll for new messages every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const lastMessage = messages[messages.length - 1];
      fetchMessages(lastMessage?.sentAt);
    }, 5000);
    return () => clearInterval(interval);
  }, [messages, fetchMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function handleSend() {
    if (!newMessage.trim() || sending) return;
    setSending(true);

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: id, body: newMessage }),
    });

    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setNewMessage("");
    }
    setSending(false);
  }

  async function handleMute() {
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mute" }),
    });
    setConversationInfo((prev) =>
      prev ? { ...prev, muted: !prev.muted } : prev
    );
  }

  async function handleReport() {
    await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "report", reason: reportReason }),
    });
    setConversationInfo((prev) =>
      prev ? { ...prev, status: "flagged" } : prev
    );
  }

  async function handleAccept() {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "accept" }),
    });
    if (res.ok) {
      setConversationInfo((prev) => prev ? { ...prev, status: "active" } : prev);
    }
  }

  async function handleDecline() {
    const res = await fetch(`/api/conversations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    if (res.ok) {
      router.push("/messages");
    }
  }

  async function handleBlock() {
    await fetch(`/api/users/${otherUser?.id}/block`, { method: "POST" });
    router.push("/messages");
  }

  async function handleReportMessage() {
    if (!reportingMessageId || !reportMessageReason.trim()) return;
    await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: reportingMessageId, reason: reportMessageReason }),
    });
    setReportingMessageId(null);
    setReportMessageReason("");
  }

  function formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return "Today";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  // Group messages by date
  const messagesByDate: Record<string, Message[]> = {};
  for (const msg of messages) {
    const dateKey = new Date(msg.sentAt).toDateString();
    if (!messagesByDate[dateKey]) messagesByDate[dateKey] = [];
    messagesByDate[dateKey].push(msg);
  }

  const otherUser = conversationInfo?.otherUser;
  const isSuspended = otherUser?.status === "suspended";
  const isClosed = conversationInfo?.status === "closed";
  const isPending = conversationInfo?.status === "pending";
  // isSender: true if current user sent the first message (i.e., initiated the request)
  const isSender = messages.length > 0 && messages[0].sender.id === currentUserId;

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/messages")}
            aria-label="Back to messages"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m12 19-7-7 7-7" />
              <path d="M19 12H5" />
            </svg>
          </Button>
          {otherUser && (
            <Link
              href={`/profile/${otherUser.id}`}
              className="flex items-center gap-2 hover:underline"
            >
              <UserAvatar name={otherUser.name} size="sm" />
              <span className="font-medium">{otherUser.name}</span>
            </Link>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={(props) => <Button variant="ghost" size="sm" aria-label="Conversation options" {...props} />}
          >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="12" cy="5" r="1" />
                <circle cx="12" cy="19" r="1" />
              </svg>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleMute}>
              {conversationInfo?.muted ? "Unmute" : "Mute"} conversation
            </DropdownMenuItem>
            <Dialog>
              <DialogTrigger
                render={(props) => <DropdownMenuItem {...props}>Report conversation</DropdownMenuItem>}
              />
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report this conversation</DialogTitle>
                  <DialogDescription>
                    Our team will review this conversation within 24 hours.
                  </DialogDescription>
                </DialogHeader>
                <Select value={reportReason} onValueChange={(v) => v && setReportReason(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="harassment">Harassment</SelectItem>
                    <SelectItem value="off-topic">Off-topic</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <DialogFooter>
                  <Button
                    variant="destructive"
                    onClick={handleReport}
                    disabled={!reportReason}
                  >
                    Submit report
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <DropdownMenuItem
              onClick={handleBlock}
              className="text-destructive focus:text-destructive"
            >
              Block {otherUser?.name ?? "user"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {messages.length === 0 && otherUser && (
          <div className="text-center py-8">
            <UserAvatar name={otherUser.name} size="lg" className="mx-auto" />
            <p className="mt-3 font-medium">{otherUser.name}</p>
            <p className="text-sm text-muted-foreground mt-1">
              Start the conversation. Most members respond within 2-3 days.
            </p>
          </div>
        )}

        {Object.entries(messagesByDate).map(([dateKey, dayMessages]) => (
          <div key={dateKey}>
            <div className="flex items-center gap-2 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground">
                {formatDate(dayMessages[0].sentAt)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              {dayMessages.map((msg) => {
                const isMine = msg.sender.id === currentUserId;
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex group",
                      isMine ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] px-3 py-2 rounded-lg",
                        isMine
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted"
                      )}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
                      <div
                        className={cn(
                          "flex items-center gap-1 mt-1",
                          isMine ? "justify-end" : "justify-start"
                        )}
                      >
                        <span
                          className={cn(
                            "text-[10px]",
                            isMine
                              ? "text-primary-foreground/70"
                              : "text-muted-foreground"
                          )}
                        >
                          {formatTime(msg.sentAt)}
                        </span>
                        {isMine && msg.readAt && (
                          <span
                            className="text-[10px] text-primary-foreground/70"
                            title={`Seen ${new Date(msg.readAt).toLocaleString()}`}
                          >
                            · Seen
                          </span>
                        )}
                      </div>
                    </div>
                    {!isMine && (
                      <button
                        onClick={() => setReportingMessageId(msg.id)}
                        className="ml-1 self-center opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                        aria-label="Report message"
                        title="Report message"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                          <line x1="4" x2="4" y1="22" y2="15" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isSuspended ? (
        <div className="py-3 px-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
          This user&apos;s account has been suspended.
        </div>
      ) : isClosed ? (
        <div className="py-3 px-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
          This conversation has been closed.
        </div>
      ) : isPending && isSender ? (
        <div className="py-3 px-4 bg-muted rounded-lg text-center text-sm text-muted-foreground">
          Waiting for {otherUser?.name ?? "them"} to accept your request.
        </div>
      ) : isPending && !isSender ? (
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleDecline} className="flex-1">
            Decline
          </Button>
          <Button onClick={handleAccept} className="flex-1">
            Accept
          </Button>
        </div>
      ) : (
        <div className="flex gap-2 pt-4 border-t">
          <Textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Type a message..."
            rows={1}
            className="resize-none"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            size="icon"
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m22 2-7 20-4-9-9-4Z" />
              <path d="M22 2 11 13" />
            </svg>
          </Button>
        </div>
      )}

      {/* Report message dialog */}
      {reportingMessageId && (
        <Dialog open onOpenChange={(open) => !open && setReportingMessageId(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report message</DialogTitle>
              <DialogDescription>
                Tell us what&apos;s wrong. Our team will review within 24 hours.
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={reportMessageReason}
              onChange={(e) => setReportMessageReason(e.target.value)}
              placeholder="Describe the issue..."
              maxLength={500}
              rows={3}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setReportingMessageId(null)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReportMessage}
                disabled={!reportMessageReason.trim()}
              >
                Submit report
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
