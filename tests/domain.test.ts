import { describe, expect, it } from "vitest";
import { suggestMapping } from "@/lib/import/targets";
import { IMPORT_TARGETS } from "@/lib/import/targets";
import { mapRole, mapStatus, mapType } from "@/lib/import/values";
import { providerFor, providerStubs } from "@/lib/notifications/providers";
import { canSeeComplaint } from "@/lib/permissions";
import { can } from "@/lib/rbac";
import { isCloseBreach, isResponseBreach, nextEscalation, shouldEscalate, slaDueDates } from "@/lib/sla";
import { summarize } from "@/lib/summary";
import { renderTemplate } from "@/lib/templates";
import { formatTicket, nextTicketNumber } from "@/lib/ticket";
import { ageInDays, ageingBucket, startOfDayIST, startOfMonthIST } from "@/lib/time";
import { assertTransition, assignmentStatus } from "@/lib/workflow";

const noon = new Date("2026-11-15T06:30:00.000Z");

describe("tickets", () => {
  it("formats the OPL sequence", () => {
    expect(formatTicket(10001)).toBe("OPL10001");
    expect(nextTicketNumber(null)).toBe("OPL10001");
    expect(nextTicketNumber("OPL10001")).toBe("OPL10002");
    expect(nextTicketNumber("OPL99999")).toBe("OPL100000");
  });
});

describe("India time and ageing", () => {
  it("uses Asia/Kolkata midnights", () => {
    expect(startOfDayIST(new Date("2026-10-31T19:00:00.000Z")).toISOString()).toBe("2026-10-31T18:30:00.000Z");
    expect(startOfMonthIST(noon).toISOString()).toBe("2026-10-31T18:30:00.000Z");
  });

  it("partitions ageing buckets", () => {
    const start = startOfDayIST(noon);
    expect(ageingBucket(start, noon)).toBe("0-2");
    expect(ageingBucket(new Date(start.getTime() - 2 * 86_400_000), noon)).toBe("0-2");
    expect(ageingBucket(new Date(start.getTime() - 3 * 86_400_000), noon)).toBe("3-7");
    expect(ageingBucket(new Date(start.getTime() - 15 * 86_400_000), noon)).toBe("8-15");
    expect(ageingBucket(new Date(start.getTime() - 16 * 86_400_000), noon)).toBe("15+");
    expect(ageInDays(new Date(start.getTime() - 16 * 86_400_000), noon)).toBe(16);
  });
});

describe("SLA and escalation", () => {
  const base = { status: "OPEN", escalationLevel: 0, firstResponseAt: null as Date | null, slaResponseDue: new Date(noon.getTime() - 3_600_000), slaCloseDue: new Date(noon.getTime() + 86_400_000), lastEscalatedAt: null as Date | null };

  it("flags an unanswered response and a late close", () => {
    expect(isResponseBreach(base, noon)).toBe(true);
    expect(isCloseBreach({ ...base, status: "ASSIGNED", firstResponseAt: noon, slaCloseDue: new Date(noon.getTime() - 1000) }, noon)).toBe(true);
    expect(isResponseBreach({ ...base, firstResponseAt: noon }, noon)).toBe(false);
    expect(isCloseBreach({ ...base, status: "CLOSED" }, noon)).toBe(false);
    const due = slaDueDates(noon, 4, 48);
    expect(due.slaCloseDue.getTime() - due.slaResponseDue.getTime()).toBe(44 * 3_600_000);
  });

  it("walks technician to area manager to state head to admin", () => {
    expect(nextEscalation(0)).toEqual({ level: 1, role: "AREA_MANAGER" });
    expect(nextEscalation(1)).toEqual({ level: 2, role: "STATE_HEAD" });
    expect(nextEscalation(2)).toEqual({ level: 3, role: "ADMIN" });
    expect(nextEscalation(3)).toBeNull();
    expect(shouldEscalate(base, noon, 12)).toBe(true);
    expect(shouldEscalate({ ...base, lastEscalatedAt: new Date(noon.getTime() - 3_600_000) }, noon, 12)).toBe(false);
    expect(shouldEscalate({ ...base, lastEscalatedAt: new Date(noon.getTime() - 3_600_000) }, noon, 12, true)).toBe(true);
    expect(shouldEscalate({ ...base, escalationLevel: 3 }, noon, 12, true)).toBe(false);
  });
});

describe("workflow and access", () => {
  it("blocks an illegal close and marks a second assignment as re-assigned", () => {
    expect(() => assertTransition("OPEN", "CLOSED")).toThrow(/Cannot move/);
    expect(assignmentStatus("OPEN", false)).toBe("ASSIGNED");
    expect(assignmentStatus("ASSIGNED", true)).toBe("REASSIGNED");
  });

  it("scopes complaints by role", () => {
    const complaint = { stateId: "hr", districtId: "karnal", brandId: "osw", assignedToUserId: "tech-1" };
    expect(canSeeComplaint({ id: "a", role: "ADMIN", stateIds: [], districtIds: [], brandIds: [] }, complaint)).toBe(true);
    expect(canSeeComplaint({ id: "tech-1", role: "TECHNICIAN", stateIds: [], districtIds: [], brandIds: [] }, complaint)).toBe(true);
    expect(canSeeComplaint({ id: "tech-2", role: "TECHNICIAN", stateIds: ["hr"], districtIds: ["karnal"], brandIds: [] }, complaint)).toBe(false);
    expect(canSeeComplaint({ id: "am", role: "AREA_MANAGER", stateIds: ["hr"], districtIds: ["karnal"], brandIds: ["osw"] }, complaint)).toBe(true);
    expect(canSeeComplaint({ id: "am", role: "AREA_MANAGER", stateIds: ["hr"], districtIds: ["hisar"], brandIds: ["osw"] }, complaint)).toBe(false);
    expect(canSeeComplaint({ id: "dealer", role: "DEALER", stateIds: [], districtIds: ["karnal"], brandIds: ["osw"] }, complaint)).toBe(false);
  });

  it("keeps dealer booking and admin control on the matrix", () => {
    expect(can("ADMIN", "runEscalation")).toBe(true);
    expect(can("DEALER", "book")).toBe(true);
    expect(can("DEALER", "close")).toBe(false);
    expect(can("TECHNICIAN", "close")).toBe(true);
    expect(can("CALL_CENTRE", "happyCall")).toBe(true);
    expect(can("TECHNICIAN", "viewReports")).toBe(false);
  });
});

describe("dashboard summary", () => {
  it("keeps the open-work cards in agreement", () => {
    const start = startOfDayIST(noon);
    const rows = [
      { status: "OPEN", type: "BREAKDOWN", createdAt: noon, firstResponseAt: null, slaResponseDue: new Date(noon.getTime() - 1000), slaCloseDue: new Date(noon.getTime() + 86_400_000) },
      { status: "ASSIGNED", type: "INSTALLATION", createdAt: new Date(start.getTime() - 4 * 86_400_000), firstResponseAt: noon, slaResponseDue: noon, slaCloseDue: new Date(noon.getTime() - 1000) },
      { status: "PENDING", type: "INSURANCE", createdAt: new Date(start.getTime() - 10 * 86_400_000), firstResponseAt: noon, slaResponseDue: noon, slaCloseDue: noon },
      { status: "REASSIGNED", type: "SCHEME", createdAt: new Date(start.getTime() - 20 * 86_400_000), firstResponseAt: noon, slaResponseDue: noon, slaCloseDue: new Date(noon.getTime() - 1000) },
      { status: "CLOSED", type: "BREAKDOWN", createdAt: new Date(noon.getTime() - 3_600_000), closedAt: noon, happyAt: null, cancelledAt: null, firstResponseAt: noon, slaResponseDue: noon, slaCloseDue: noon },
      { status: "HAPPY_CALLING_DONE", type: "MOBILE_APP", createdAt: noon, closedAt: noon, happyAt: noon, cancelledAt: null, firstResponseAt: noon, slaResponseDue: noon, slaCloseDue: noon },
      { status: "CANCELLED", type: "BREAKDOWN", createdAt: noon, closedAt: null, happyAt: null, cancelledAt: noon, firstResponseAt: null, slaResponseDue: noon, slaCloseDue: noon },
    ];
    const cards = summarize(rows, noon);
    expect(cards.open + cards.assigned + cards.pending).toBe(cards.totalPending);
    expect(cards.breakdown + cards.installation + cards.insurance + cards.mobile + cards.scheme).toBe(cards.totalPending);
    expect(cards.age02 + cards.age37 + cards.age815 + cards.age15).toBe(cards.totalPending);
    expect(cards.todayLogin).toBe(4);
    expect(cards.todayClosed).toBe(2);
    expect(cards.todayHappy).toBe(1);
    expect(cards.todayCancelled).toBe(1);
    expect(cards.responseBreach).toBe(1);
    expect(cards.closeBreach).toBe(2);
  });
});

describe("import mapping and templates", () => {
  it("maps Smartlogics complaint headers", () => {
    const headers = ["Complaint No", "Call Date", "Customer", "Mobile No", "Serial Number", "Product", "Call Type", "Complaint Source", "Problem", "State Name", "District Name", "Pincode", "Narration", "Status", "Scheme"];
    const mapping = suggestMapping(headers, IMPORT_TARGETS.complaints.fields);
    expect(mapping.externalRef).toBe("Complaint No");
    expect(mapping.phone).toBe("Mobile No");
    expect(mapping.customerName).toBe("Customer");
    expect(mapping.type).toBe("Call Type");
    expect(mapping.issue).toBe("Problem");
    expect(mapping.state).toBe("State Name");
    expect(mapping.description).toBe("Narration");
    expect(mapType("MSEDCL")).toEqual({ type: "SCHEME", scheme: "MSEDCL" });
    expect(mapStatus("Re-Assigned")).toBe("REASSIGNED");
    expect(mapRole("Call Centre")).toBe("CALL_CENTRE");
  });

  it("renders the feedback link and keeps providers off", () => {
    expect(renderTemplate("Rate {{ticketNumber}}: {{feedbackLink}}", { ticketNumber: "OPL10001", feedbackLink: "http://localhost/feedback/abc" })).toBe("Rate OPL10001: http://localhost/feedback/abc");
    expect(providerFor("whatsapp").name).toBe("console");
    expect(providerFor("sms").name).toBe("console");
    expect(providerStubs.whatsappCloud.isConfigured()).toBe(false);
    expect(providerStubs.gupshup.isConfigured()).toBe(false);
    expect(providerStubs.msg91.isConfigured()).toBe(false);
    expect(providerStubs.whatsappCloud.payload({ to: "9811000001", body: "Hello" })).toMatchObject({ messaging_product: "whatsapp", to: "9811000001" });
  });
});
