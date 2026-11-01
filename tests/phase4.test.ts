import { describe, expect, it } from "vitest";
import { chatTurn, freshChat } from "../src/lib/chatbot";
import { companyCodeForCategory } from "../src/lib/company-tag";
import { hashReportKey, issueTrackToken, reportKeyAccepted } from "../src/lib/report-key";

describe("tracking", () => {
  it("issues a token that is not a ticket number", () => {
    const token = issueTrackToken();
    expect(token.length).toBeGreaterThan(16);
    expect(token.startsWith("OPL")).toBe(false);
  });
});

describe("whatsapp menu", () => {
  it("books a pump, including KUSUM, as Oswal Pumps and a panel as Oswal Solar", () => {
    let session = freshChat();
    session = chatTurn(session, "1").session;
    session = chatTurn(session, "Ramesh Kumar").session;
    session = chatTurn(session, "PM-KUSUM solar pump").session;
    session = chatTurn(session, "No water").session;
    session = chatTurn(session, "Karnal 132001").session;
    const confirm = chatTurn(session, "SKIP", true);
    expect(confirm.messages[0]).toContain("Oswal Pumps");
    expect(confirm.messages[0]).toContain("open complaint");
    const booked = chatTurn(confirm.session, "YES", true);
    expect(booked.action).toMatchObject({ type: "book", company: "PUMPS", duplicate: true });
    expect(companyCodeForCategory("rooftop inverter")).toBe("SOLAR");
    const solar = chatTurn(chatTurn(chatTurn(chatTurn(freshChat(), "1").session, "Asha").session, "rooftop panel").session, "Low generation").session;
    const solarPlace = chatTurn(solar, "Pune 411001").session;
    const solarConfirm = chatTurn(solarPlace, "SKIP");
    expect(solarConfirm.messages[0]).toContain("Oswal Solar");
  });

  it("switches language and creates an agent handoff", () => {
    const hindi = chatTurn(freshChat(), "9");
    expect(hindi.session.lang).toBe("hi");
    expect(hindi.messages[0]).toContain("शिकायत");
    const agent = chatTurn(freshChat(), "3");
    expect(agent.action?.type).toBe("agent");
  });
});

describe("reporting keys", () => {
  it("accepts only the matching secret", () => {
    const hash = hashReportKey("osk_demo");
    expect(reportKeyAccepted("osk_demo", [hash])).toBe(true);
    expect(reportKeyAccepted("osk_other", [hash])).toBe(false);
    expect(reportKeyAccepted("", [hash])).toBe(false);
  });
});
