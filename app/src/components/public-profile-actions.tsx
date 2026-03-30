"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PublicProfileActions({
  profileUserId,
  existingConversationId,
  initiallyBlocked,
}: {
  profileUserId: string;
  existingConversationId: string | null;
  initiallyBlocked: boolean;
}) {
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [unblocking, setUnblocking] = useState(false);

  async function handleUnblock() {
    setUnblocking(true);
    try {
      const res = await fetch(`/api/users/${profileUserId}/block`, {
        method: "DELETE",
      });
      if (res.ok) setBlocked(false);
    } finally {
      setUnblocking(false);
    }
  }

  if (blocked) {
    return (
      <div className="flex flex-col items-end gap-2 text-right">
        <p className="text-xs text-muted-foreground max-w-[14rem]">
          You&apos;ve blocked this person. They can&apos;t message you until you
          unblock.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleUnblock()}
          disabled={unblocking}
        >
          {unblocking ? "Unblocking…" : "Unblock"}
        </Button>
      </div>
    );
  }

  return (
    <div>
      {existingConversationId ? (
        <Link href={`/messages/${existingConversationId}`}>
          <Button>View Conversation</Button>
        </Link>
      ) : (
        <Link href={`/messages?new=${profileUserId}`}>
          <Button>Send Message</Button>
        </Link>
      )}
    </div>
  );
}
