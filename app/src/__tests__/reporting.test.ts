/**
 * Integration Tests: Reporting
 * - POST /api/reports creates a Report record
 * - POST /api/reports validates messageId and reason
 * - GET /api/admin/reports lists pending reports
 * - PATCH /api/admin/reports/[id] dismiss sets status to dismissed
 * - PATCH /api/admin/reports/[id] suspend sets reported user status to suspended + report to actioned
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { resetStores, stores } from "./mock-db";
import {
  createRequest,
  parseResponse,
  seedAdmin,
  seedOnboardedUser,
  seedPendingConversation,
  seedReport,
} from "./helpers";

const mockAuth = vi.fn();
vi.mock("@/lib/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
}));

import { POST as fileReportHandler } from "@/app/api/reports/route";
import { GET as listReportsHandler } from "@/app/api/admin/reports/route";
import { PATCH as reviewReportHandler } from "@/app/api/admin/reports/[id]/route";

function setSession(userId: string) {
  mockAuth.mockResolvedValue({ user: { id: userId, name: "Test", email: "t@t.com" } });
}

function makeParams(id: string) {
  return Promise.resolve({ id });
}

describe("Reporting", () => {
  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  describe("POST /api/reports", () => {
    it("creates a Report record", async () => {
      const reporter = await seedOnboardedUser();
      const reported = await seedOnboardedUser();
      const { messageId } = seedPendingConversation(reporter.id, reported.id, "Hello there");
      setSession(reporter.id);

      const req = createRequest("/api/reports", {
        method: "POST",
        body: { messageId, reason: "Inappropriate content" },
      });
      const res = await fileReportHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(201);
      expect(data.id).toBeTruthy();
      expect(stores.reports.size).toBe(1);
      const report = [...stores.reports.values()][0];
      expect(report.reporterId).toBe(reporter.id);
      expect(report.messageId).toBe(messageId);
      expect(report.status).toBe("pending");
    });

    it("returns 400 when messageId is missing", async () => {
      const reporter = await seedOnboardedUser();
      setSession(reporter.id);

      const req = createRequest("/api/reports", {
        method: "POST",
        body: { reason: "Inappropriate content" },
      });
      const res = await fileReportHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when reason is missing", async () => {
      const reporter = await seedOnboardedUser();
      const reported = await seedOnboardedUser();
      const { messageId } = seedPendingConversation(reporter.id, reported.id, "Hello there");
      setSession(reporter.id);

      const req = createRequest("/api/reports", {
        method: "POST",
        body: { messageId },
      });
      const res = await fileReportHandler(req);
      expect(res.status).toBe(400);
    });

    it("returns 403 when reporter is not a member of the conversation", async () => {
      const reporter = await seedOnboardedUser();
      const userA = await seedOnboardedUser();
      const userB = await seedOnboardedUser();
      const { messageId } = seedPendingConversation(userA.id, userB.id, "Hello there");
      setSession(reporter.id);

      const req = createRequest("/api/reports", {
        method: "POST",
        body: { messageId, reason: "Not in this conversation" },
      });
      const res = await fileReportHandler(req);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/admin/reports", () => {
    it("returns pending reports for admin", async () => {
      const admin = await seedAdmin();
      const reporter = await seedOnboardedUser();
      const reported = await seedOnboardedUser();
      const { messageId } = seedPendingConversation(reporter.id, reported.id, "Hello there");
      seedReport(reporter.id, reported.id, messageId);
      setSession(admin.id);

      const req = createRequest("/api/admin/reports?status=pending");
      const res = await listReportsHandler(req);
      const data = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(data.length).toBe(1);
      expect(data[0].status).toBe("pending");
      expect(data[0].reporter.name).toBeTruthy();
      expect(data[0].reportedUser.name).toBeTruthy();
      expect(data[0].message.body).toBeTruthy();
    });

    it("returns 403 for non-admin users", async () => {
      const user = await seedOnboardedUser();
      setSession(user.id);

      const req = createRequest("/api/admin/reports");
      const res = await listReportsHandler(req);
      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /api/admin/reports/[id] dismiss", () => {
    it("sets report status to dismissed", async () => {
      const admin = await seedAdmin();
      const reporter = await seedOnboardedUser();
      const reported = await seedOnboardedUser();
      const { messageId } = seedPendingConversation(reporter.id, reported.id, "Hello there");
      const reportId = seedReport(reporter.id, reported.id, messageId);
      setSession(admin.id);

      const req = createRequest(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        body: { action: "dismiss" },
      });
      const res = await reviewReportHandler(req, { params: makeParams(reportId) });

      expect(res.status).toBe(200);
      expect(stores.reports.get(reportId)!.status).toBe("dismissed");
    });
  });

  describe("PATCH /api/admin/reports/[id] suspend", () => {
    it("sets reported user status to suspended and report to actioned", async () => {
      const admin = await seedAdmin();
      const reporter = await seedOnboardedUser();
      const reported = await seedOnboardedUser();
      const { messageId } = seedPendingConversation(reporter.id, reported.id, "Hello there");
      const reportId = seedReport(reporter.id, reported.id, messageId);
      setSession(admin.id);

      const req = createRequest(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        body: { action: "suspend" },
      });
      const res = await reviewReportHandler(req, { params: makeParams(reportId) });

      expect(res.status).toBe(200);
      expect(stores.reports.get(reportId)!.status).toBe("actioned");
      expect(stores.users.get(reported.id)!.status).toBe("suspended");
    });
  });
});
