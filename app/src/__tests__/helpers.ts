/**
 * Test helpers for creating mock requests and seeding test data.
 */
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { stores, genId, type MockUser, type MockDistrict } from "./mock-db";

// ─── Request helpers ─────────────────────────────────────────────────────

export function createRequest(
  url: string,
  options?: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  }
): NextRequest {
  const fullUrl = url.startsWith("http") ? url : `http://localhost:3000${url}`;
  const init: RequestInit = {
    method: options?.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  };
  if (options?.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(fullUrl, init);
}

export async function parseResponse(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

// ─── Seed helpers ────────────────────────────────────────────────────────

export async function seedUser(overrides?: Partial<MockUser>): Promise<MockUser> {
  const id = genId();
  const user: MockUser = {
    id,
    email: `user_${id}@test.com`,
    passwordHash: await hash("password123", 4), // low rounds for speed
    name: `Test User ${id}`,
    role: null,
    bio: null,
    districtId: null,
    isAdmin: false,
    emailVerified: false,
    onboarded: false,
    status: "active",
    createdAt: new Date(),
    lastActiveAt: null,
    ...overrides,
  };
  stores.users.set(user.id, user);
  return user;
}

export async function seedOnboardedUser(overrides?: Partial<MockUser> & {
  districtOverrides?: Partial<MockDistrict>;
  problemIds?: string[];
}): Promise<MockUser> {
  const district = seedDistrict(overrides?.districtOverrides);
  const user = await seedUser({
    districtId: district.id,
    role: "literacy_director",
    bio: "Test bio",
    onboarded: true,
    ...overrides,
  });
  // Assign problems
  const problemIds = overrides?.problemIds ?? ["ps_1", "ps_2"];
  for (const problemId of problemIds) {
    const upId = genId();
    stores.userProblems.set(upId, {
      id: upId,
      userId: user.id,
      problemId,
      selectedAt: new Date(),
    });
  }
  return user;
}

export async function seedAdmin(): Promise<MockUser> {
  return seedUser({
    isAdmin: true,
    onboarded: true,
    emailVerified: true,
    name: "Admin User",
    email: "admin@test.com",
  });
}

export function seedDistrict(overrides?: Partial<MockDistrict>): MockDistrict {
  const id = genId();
  const district: MockDistrict = {
    id,
    ncesId: `NCES_${id}`,
    name: `Test District ${id}`,
    state: "CA",
    localeCode: "21",
    urbanicity: "suburban",
    totalEnrollment: 10000,
    sizeBucket: "medium",
    frlPct: 35.0,
    ellPct: 12.0,
    isManual: false,
    updatedAt: new Date(),
    ...overrides,
  };
  stores.districts.set(district.id, district);
  return district;
}

export function seedProblemStatements(): void {
  const problems = [
    { id: "ps_1", label: "Adopting a new core reading/ELA curriculum", category: "Curriculum & Instruction", sortOrder: 1 },
    { id: "ps_2", label: "Implementing Science of Reading practices", category: "Curriculum & Instruction", sortOrder: 2 },
    { id: "ps_3", label: "Aligning literacy instruction across grade bands", category: "Curriculum & Instruction", sortOrder: 3 },
    { id: "ps_4", label: "Using data to drive intervention placement", category: "Assessment & Data", sortOrder: 4 },
    { id: "ps_5", label: "Designing or improving an MTSS framework", category: "Intervention & MTSS", sortOrder: 5 },
  ];
  for (const p of problems) {
    stores.problemStatements.set(p.id, {
      ...p,
      active: true,
      createdAt: new Date(),
    });
  }
}

export function seedConversation(userAId: string, userBId: string): {
  conversationId: string;
  memberAId: string;
  memberBId: string;
} {
  const conversationId = genId();
  const memberAId = genId();
  const memberBId = genId();

  stores.conversations.set(conversationId, {
    id: conversationId,
    status: "active",
    createdAt: new Date(),
  });
  stores.conversationMembers.set(memberAId, {
    id: memberAId,
    conversationId,
    userId: userAId,
    muted: false,
    lastReadAt: null,
    joinedAt: new Date(),
  });
  stores.conversationMembers.set(memberBId, {
    id: memberBId,
    conversationId,
    userId: userBId,
    muted: false,
    lastReadAt: null,
    joinedAt: new Date(),
  });

  return { conversationId, memberAId, memberBId };
}

export function seedMessage(conversationId: string, senderId: string, body: string, overrides?: Partial<{
  readAt: Date | null;
  flagged: boolean;
  deletedAt: Date | null;
  sentAt: Date;
}>): string {
  const id = genId();
  stores.messages.set(id, {
    id,
    conversationId,
    senderId,
    body,
    sentAt: overrides?.sentAt ?? new Date(),
    readAt: overrides?.readAt ?? null,
    flagged: overrides?.flagged ?? false,
    deletedAt: overrides?.deletedAt ?? null,
  });
  return id;
}

export function seedKeyword(keyword: string): string {
  const id = genId();
  stores.keywordAlerts.set(id, {
    id,
    keyword,
    active: true,
    hitCount: 0,
    createdAt: new Date(),
  });
  return id;
}
