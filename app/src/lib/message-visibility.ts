import { db } from "@/lib/db";

/** User IDs the viewer has blocked — their messages are hidden from the viewer's UI. */
export async function getBlockedUserIdsForViewer(viewerId: string): Promise<Set<string>> {
  const rows = await db.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
  });
  return new Set(rows.map((r) => r.blockedId));
}

export function isMessageVisibleToViewer<T extends { senderId: string }>(
  message: T,
  viewerId: string,
  blockedUserIds: Set<string>
): boolean {
  return message.senderId === viewerId || !blockedUserIds.has(message.senderId);
}

export function filterMessagesVisibleToViewer<T extends { senderId: string }>(
  messages: T[],
  viewerId: string,
  blockedUserIds: Set<string>
): T[] {
  return messages.filter((m) => isMessageVisibleToViewer(m, viewerId, blockedUserIds));
}
