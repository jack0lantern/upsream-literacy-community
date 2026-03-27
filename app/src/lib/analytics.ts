import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

type EventType =
  | "signup"
  | "profile_complete"
  | "match_viewed"
  | "message_sent"
  | "conversation_started"
  | "login"
  | "password_reset";

export async function trackEvent(
  eventType: EventType,
  userId?: string,
  properties?: Record<string, unknown>
) {
  try {
    await db.analyticsEvent.create({
      data: {
        eventType,
        userId: userId ?? null,
        properties: properties ? JSON.parse(JSON.stringify(properties)) : undefined,
      },
    });
  } catch (error) {
    logger.error({ error, eventType, userId }, "Failed to track analytics event");
  }
}
