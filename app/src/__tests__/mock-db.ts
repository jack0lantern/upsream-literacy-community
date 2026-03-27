/**
 * In-memory mock database for integration testing.
 * Simulates Prisma client behavior with Map-backed storage.
 */
import { vi } from "vitest";

// ─── In-memory stores ────────────────────────────────────────────────────

export interface MockUser {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  role: string | null;
  bio: string | null;
  districtId: string | null;
  isAdmin: boolean;
  emailVerified: boolean;
  onboarded: boolean;
  status: string;
  createdAt: Date;
  lastActiveAt: Date | null;
}

export interface MockDistrict {
  id: string;
  ncesId: string | null;
  name: string;
  state: string;
  localeCode: string | null;
  urbanicity: string | null;
  totalEnrollment: number | null;
  sizeBucket: string | null;
  frlPct: number | null;
  ellPct: number | null;
  isCharterAgency: boolean | null;
  isManual: boolean;
  updatedAt: Date;
}

export interface MockProblemStatement {
  id: string;
  label: string;
  category: string;
  sortOrder: number;
  active: boolean;
  createdAt: Date;
}

export interface MockUserProblem {
  id: string;
  userId: string;
  problemId: string;
  selectedAt: Date;
}

export interface MockConversation {
  id: string;
  status: string;
  createdAt: Date;
}

export interface MockConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  muted: boolean;
  lastReadAt: Date | null;
  joinedAt: Date;
}

export interface MockMessage {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  sentAt: Date;
  readAt: Date | null;
  flagged: boolean;
  deletedAt: Date | null;
}

export interface MockAnalyticsEvent {
  id: string;
  userId: string | null;
  eventType: string;
  properties: unknown;
  createdAt: Date;
}

export interface MockEmailVerificationToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface MockPasswordResetToken {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface MockKeywordAlert {
  id: string;
  keyword: string;
  active: boolean;
  hitCount: number;
  createdAt: Date;
}

// ─── Data stores ─────────────────────────────────────────────────────────

export const stores = {
  users: new Map<string, MockUser>(),
  districts: new Map<string, MockDistrict>(),
  problemStatements: new Map<string, MockProblemStatement>(),
  userProblems: new Map<string, MockUserProblem>(),
  conversations: new Map<string, MockConversation>(),
  conversationMembers: new Map<string, MockConversationMember>(),
  messages: new Map<string, MockMessage>(),
  analyticsEvents: new Map<string, MockAnalyticsEvent>(),
  emailVerificationTokens: new Map<string, MockEmailVerificationToken>(),
  passwordResetTokens: new Map<string, MockPasswordResetToken>(),
  keywordAlerts: new Map<string, MockKeywordAlert>(),
};

let idCounter = 0;
export function genId(): string {
  return `test_${++idCounter}`;
}

export function resetStores() {
  for (const store of Object.values(stores)) store.clear();
  idCounter = 0;
}

// ─── Query helpers ───────────────────────────────────────────────────────

function matchesWhere<T>(item: T, where: Record<string, unknown>): boolean {
  for (const [key, val] of Object.entries(where)) {
    if (key === "AND") {
      return (val as Record<string, unknown>[]).every((w) =>
        matchesWhere(item, w)
      );
    }
    if (key === "OR") {
      return (val as Record<string, unknown>[]).some((w) =>
        matchesWhere(item, w)
      );
    }
    if (key === "NOT") {
      return !matchesWhere(item, val as Record<string, unknown>);
    }

    const itemVal = (item as Record<string, unknown>)[key];

    if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
      const op = val as Record<string, unknown>;
      if ("contains" in op) {
        const mode = op.mode as string | undefined;
        const s = String(itemVal ?? "");
        const q = String(op.contains);
        if (mode === "insensitive") {
          if (!s.toLowerCase().includes(q.toLowerCase())) return false;
        } else {
          if (!s.includes(q)) return false;
        }
        continue;
      }
      if ("in" in op) {
        if (!(op.in as unknown[]).includes(itemVal)) return false;
        continue;
      }
      if ("not" in op) {
        if (itemVal === op.not) return false;
        continue;
      }
      if ("gte" in op) {
        if (itemVal == null || (itemVal as number) < (op.gte as number))
          return false;
        continue;
      }
      if ("gt" in op) {
        if (itemVal == null) return false;
        if (itemVal instanceof Date && op.gt instanceof Date) {
          if (itemVal.getTime() <= op.gt.getTime()) return false;
        } else if ((itemVal as number) <= (op.gt as number)) return false;
        continue;
      }
      if ("some" in op) {
        // Relation filter — skip in simple mock (handled at call site)
        continue;
      }
      if ("none" in op) {
        continue;
      }
      // Nested relation filter — recurse
      // e.g. { district: { state: "CA" } }
      continue;
    }
    if (itemVal !== val) return false;
  }
  return true;
}

function findMany<T>(
  store: Map<string, T>,
  opts?: {
    where?: Record<string, unknown>;
    orderBy?: Record<string, string> | Record<string, string>[];
    take?: number;
    skip?: number;
  }
): T[] {
  let items = [...store.values()];
  if (opts?.where) {
    items = items.filter((i) => matchesWhere(i, opts.where!));
  }
  if (opts?.take) items = items.slice(opts.skip ?? 0, (opts.skip ?? 0) + opts.take);
  return items;
}

// ─── Build mock Prisma client ────────────────────────────────────────────

function buildModelProxy<T extends { id: string }>(
  store: Map<string, T>,
  defaults: () => Partial<T>
) {
  return {
    findUnique: vi.fn(async (args: { where: Record<string, unknown>; include?: unknown; select?: unknown }) => {
      const w = args.where;
      for (const item of store.values()) {
        if (matchesWhere(item, w)) return item;
      }
      return null;
    }),
    findFirst: vi.fn(async (args?: { where?: Record<string, unknown>; select?: unknown }) => {
      if (!args?.where) return store.values().next().value ?? null;
      for (const item of store.values()) {
        if (matchesWhere(item, args.where)) return item;
      }
      return null;
    }),
    findMany: vi.fn(async (args?: { where?: Record<string, unknown>; orderBy?: unknown; take?: number; skip?: number; include?: unknown; select?: unknown }) => {
      return findMany(store, args);
    }),
    create: vi.fn(async (args: { data: Partial<T> }) => {
      const id = (args.data as Record<string, unknown>).id as string ?? genId();
      const item = { ...defaults(), ...args.data, id } as T;
      store.set(id, item);
      return item;
    }),
    update: vi.fn(async (args: { where: Record<string, unknown>; data: Partial<T> }) => {
      for (const item of store.values()) {
        if (matchesWhere(item, args.where)) {
          const data = args.data as Record<string, unknown>;
          // Handle increment
          for (const [k, v] of Object.entries(data)) {
            if (v && typeof v === "object" && "increment" in (v as Record<string, unknown>)) {
              (item as Record<string, unknown>)[k] = ((item as Record<string, unknown>)[k] as number ?? 0) + ((v as Record<string, unknown>).increment as number);
              delete data[k];
            }
          }
          Object.assign(item, data);
          return item;
        }
      }
      return null;
    }),
    updateMany: vi.fn(async (args: { where?: Record<string, unknown>; data: Partial<T> }) => {
      let count = 0;
      for (const item of store.values()) {
        if (!args.where || matchesWhere(item, args.where)) {
          Object.assign(item, args.data);
          count++;
        }
      }
      return { count };
    }),
    upsert: vi.fn(async (args: { where: Record<string, unknown>; create: Partial<T>; update: Partial<T> }) => {
      for (const item of store.values()) {
        if (matchesWhere(item, args.where)) {
          Object.assign(item, args.update);
          return item;
        }
      }
      const id = (args.create as Record<string, unknown>).id as string ?? genId();
      const item = { ...defaults(), ...args.create, id } as T;
      store.set(id, item);
      return item;
    }),
    delete: vi.fn(async (args: { where: Record<string, unknown> }) => {
      for (const [key, item] of store.entries()) {
        if (matchesWhere(item, args.where)) {
          store.delete(key);
          return item;
        }
      }
      return null;
    }),
    deleteMany: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
      let count = 0;
      for (const [key, item] of store.entries()) {
        if (!args?.where || matchesWhere(item, args.where)) {
          store.delete(key);
          count++;
        }
      }
      return { count };
    }),
    count: vi.fn(async (args?: { where?: Record<string, unknown> }) => {
      if (!args?.where) return store.size;
      return [...store.values()].filter((i) => matchesWhere(i, args.where!)).length;
    }),
  };
}

// ─── Relation resolvers ──────────────────────────────────────────────

function resolveUserRelations(user: MockUser) {
  return {
    ...user,
    district: user.districtId ? stores.districts.get(user.districtId) ?? null : null,
    problems: [...stores.userProblems.values()]
      .filter((up) => up.userId === user.id)
      .map((up) => ({
        ...up,
        problem: stores.problemStatements.get(up.problemId) ?? null,
      })),
    _count: {
      problems: [...stores.userProblems.values()].filter((up) => up.userId === user.id).length,
    },
  };
}

function resolveConversationRelations(conv: MockConversation) {
  return {
    ...conv,
    members: [...stores.conversationMembers.values()]
      .filter((cm) => cm.conversationId === conv.id)
      .map((cm) => ({
        ...cm,
        user: stores.users.get(cm.userId) ?? null,
      })),
    messages: [...stores.messages.values()]
      .filter((m) => m.conversationId === conv.id && !m.deletedAt)
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .map((m) => ({
        ...m,
        sender: stores.users.get(m.senderId) ? { id: m.senderId, name: stores.users.get(m.senderId)!.name } : null,
      })),
  };
}

function resolveConversationMemberRelations(cm: MockConversationMember) {
  const conv = stores.conversations.get(cm.conversationId);
  return {
    ...cm,
    conversation: conv ? resolveConversationRelations(conv) : null,
    user: stores.users.get(cm.userId) ?? null,
  };
}

function resolveMessageRelations(msg: MockMessage) {
  const sender = stores.users.get(msg.senderId);
  return {
    ...msg,
    sender: sender ? { id: sender.id, name: sender.name } : null,
  };
}

function resolveProblemStatementRelations(ps: MockProblemStatement) {
  return {
    ...ps,
    _count: {
      users: [...stores.userProblems.values()].filter((up) => up.problemId === ps.id).length,
    },
  };
}

// ─── Build enhanced mock DB ──────────────────────────────────────────

const baseUser = buildModelProxy(stores.users, () => ({
  role: null, bio: null, districtId: null, isAdmin: false,
  emailVerified: false, onboarded: false, status: "active",
  createdAt: new Date(), lastActiveAt: null,
}));

const baseDistrict = buildModelProxy(stores.districts, () => ({
  ncesId: null, localeCode: null, urbanicity: null, totalEnrollment: null,
  sizeBucket: null, frlPct: null, ellPct: null, isCharterAgency: null, isManual: false, updatedAt: new Date(),
}));

const baseProblemStatement = buildModelProxy(stores.problemStatements, () => ({
  active: true, createdAt: new Date(),
}));

const baseUserProblem = buildModelProxy(stores.userProblems, () => ({
  selectedAt: new Date(),
}));

const baseConversation = buildModelProxy(stores.conversations, () => ({
  status: "active", createdAt: new Date(),
}));

const baseConversationMember = buildModelProxy(stores.conversationMembers, () => ({
  muted: false, lastReadAt: null, joinedAt: new Date(),
}));

const baseMessage = buildModelProxy(stores.messages, () => ({
  sentAt: new Date(), readAt: null, flagged: false, deletedAt: null,
}));

// Override methods that need relation resolution
baseUser.findUnique = vi.fn(async (args: { where: Record<string, unknown>; include?: unknown; select?: unknown }) => {
  for (const item of stores.users.values()) {
    if (matchesWhere(item, args.where)) {
      return args.include ? resolveUserRelations(item) : item;
    }
  }
  return null;
});

baseUser.findMany = vi.fn(async (args?: { where?: Record<string, unknown>; include?: unknown; orderBy?: unknown; take?: number; skip?: number; select?: unknown }) => {
  let items = [...stores.users.values()];
  if (args?.where) {
    items = items.filter((i) => {
      // Handle nested district relation filter
      const where = { ...args.where! };
      if (where.district && typeof where.district === "object") {
        const districtFilter = where.district as Record<string, unknown>;
        const district = i.districtId ? stores.districts.get(i.districtId) : null;
        if (!district) return false;
        for (const [k, v] of Object.entries(districtFilter)) {
          if ((district as Record<string, unknown>)[k] !== v) return false;
        }
        delete where.district;
      }
      return matchesWhere(i, where);
    });
  }
  if (args?.skip) items = items.slice(args.skip);
  if (args?.take) items = items.slice(0, args.take);
  return args?.include ? items.map(resolveUserRelations) : items;
});

// ConversationMember needs compound key support
baseConversationMember.findUnique = vi.fn(async (args: { where: Record<string, unknown>; include?: unknown }) => {
  const w = args.where;
  // Handle compound key: conversationId_userId
  if (w.conversationId_userId) {
    const compound = w.conversationId_userId as { conversationId: string; userId: string };
    for (const item of stores.conversationMembers.values()) {
      if (item.conversationId === compound.conversationId && item.userId === compound.userId) {
        return args.include ? resolveConversationMemberRelations(item) : item;
      }
    }
    return null;
  }
  for (const item of stores.conversationMembers.values()) {
    if (matchesWhere(item, w)) {
      return args.include ? resolveConversationMemberRelations(item) : item;
    }
  }
  return null;
});

baseConversationMember.findFirst = vi.fn(async (args?: { where?: Record<string, unknown>; include?: unknown; select?: unknown }) => {
  if (!args?.where) {
    const first = stores.conversationMembers.values().next().value;
    return first ? (args?.include ? resolveConversationMemberRelations(first) : first) : null;
  }
  // Handle nested relation filter: { userId: x, conversation: { members: { some: { userId: y } } } }
  for (const item of stores.conversationMembers.values()) {
    let match = true;
    if (args.where.userId && item.userId !== args.where.userId) match = false;
    if (args.where.conversationId && item.conversationId !== args.where.conversationId) match = false;
    if (match && args.where.conversation) {
      const convFilter = args.where.conversation as Record<string, unknown>;
      if (convFilter.members) {
        const membersFilter = convFilter.members as { some?: { userId?: string } };
        if (membersFilter.some?.userId) {
          const otherUserId = membersFilter.some.userId;
          const hasOther = [...stores.conversationMembers.values()].some(
            (cm) => cm.conversationId === item.conversationId && cm.userId === otherUserId
          );
          if (!hasOther) match = false;
        }
      }
    }
    if (match) return args.include ? resolveConversationMemberRelations(item) : item;
  }
  return null;
});

baseConversationMember.findMany = vi.fn(async (args?: { where?: Record<string, unknown>; include?: unknown; orderBy?: unknown }) => {
  let items = [...stores.conversationMembers.values()];
  if (args?.where) {
    items = items.filter((item) => {
      if (args.where!.userId && item.userId !== args.where!.userId) return false;
      if (args.where!.conversationId && item.conversationId !== args.where!.conversationId) return false;
      return true;
    });
  }
  return args?.include ? items.map(resolveConversationMemberRelations) : items;
});

// Conversation needs nested create support for members
const origConvCreate = baseConversation.create;
baseConversation.create = vi.fn(async (args: { data: Record<string, unknown> }) => {
  const id = (args.data.id as string) ?? genId();
  const conv = { id, status: "active" as const, createdAt: new Date() };
  stores.conversations.set(id, conv);

  // Handle nested members create
  if (args.data.members && typeof args.data.members === "object") {
    const membersData = args.data.members as { create?: Array<{ userId: string }> };
    if (membersData.create) {
      for (const memberData of membersData.create) {
        const mId = genId();
        stores.conversationMembers.set(mId, {
          id: mId,
          conversationId: id,
          userId: memberData.userId,
          muted: false,
          lastReadAt: null,
          joinedAt: new Date(),
        });
      }
    }
  }

  return conv;
});

// Conversation findUnique/findMany with includes
baseConversation.findUnique = vi.fn(async (args: { where: Record<string, unknown>; include?: unknown; select?: unknown }) => {
  for (const item of stores.conversations.values()) {
    if (matchesWhere(item, args.where)) {
      return args.include ? resolveConversationRelations(item) : item;
    }
  }
  return null;
});

baseConversation.findMany = vi.fn(async (args?: { where?: Record<string, unknown>; include?: unknown; orderBy?: unknown; take?: number }) => {
  let items = [...stores.conversations.values()];
  if (args?.where) items = items.filter((i) => matchesWhere(i, args.where!));
  return args?.include ? items.map(resolveConversationRelations) : items;
});

// Message findMany with includes
baseMessage.findMany = vi.fn(async (args?: { where?: Record<string, unknown>; include?: unknown; orderBy?: unknown; take?: number; select?: unknown }) => {
  let items = [...stores.messages.values()];
  if (args?.where) items = items.filter((i) => matchesWhere(i, args.where!));
  // Sort by sentAt asc by default
  items.sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  if (args?.take) items = items.slice(0, args.take);
  return args?.include ? items.map(resolveMessageRelations) : items;
});

baseMessage.create = vi.fn(async (args: { data: Record<string, unknown>; include?: unknown }) => {
  const id = (args.data.id as string) ?? genId();
  const msg: MockMessage = {
    id,
    conversationId: args.data.conversationId as string,
    senderId: args.data.senderId as string,
    body: args.data.body as string,
    sentAt: (args.data.sentAt as Date) ?? new Date(),
    readAt: (args.data.readAt as Date) ?? null,
    flagged: (args.data.flagged as boolean) ?? false,
    deletedAt: null,
  };
  stores.messages.set(id, msg);
  return args.include ? resolveMessageRelations(msg) : msg;
});

// ProblemStatement findMany with _count
baseProblemStatement.findMany = vi.fn(async (args?: { where?: Record<string, unknown>; orderBy?: unknown; include?: unknown; select?: unknown }) => {
  let items = [...stores.problemStatements.values()];
  if (args?.where) items = items.filter((i) => matchesWhere(i, args.where!));
  return args?.include ? items.map(resolveProblemStatementRelations) : items;
});

export const mockDb = {
  user: baseUser,
  district: baseDistrict,
  problemStatement: baseProblemStatement,
  userProblem: baseUserProblem,
  conversation: baseConversation,
  conversationMember: baseConversationMember,
  message: baseMessage,
  analyticsEvent: buildModelProxy(stores.analyticsEvents, () => ({
    userId: null, properties: null, createdAt: new Date(),
  })),
  emailVerificationToken: buildModelProxy(stores.emailVerificationTokens, () => ({
    expiresAt: new Date(Date.now() + 86400000),
  })),
  passwordResetToken: buildModelProxy(stores.passwordResetTokens, () => ({
    expiresAt: new Date(Date.now() + 3600000),
  })),
  keywordAlert: buildModelProxy(stores.keywordAlerts, () => ({
    active: true, hitCount: 0, createdAt: new Date(),
  })),
  $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  $transaction: vi.fn(async (opsOrFn: unknown[] | ((tx: unknown) => unknown)) => {
    if (typeof opsOrFn === "function") {
      return await opsOrFn(mockDb);
    }
    const results = [];
    for (const op of opsOrFn) {
      results.push(await (op as Promise<unknown>));
    }
    return results;
  }),
};

// Mock the db module
vi.mock("@/lib/db", () => ({
  db: mockDb,
}));
