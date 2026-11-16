import { describe, expect, it } from "vitest";
import {
  allowPublicAttempt,
  allowSend,
  checkCaptcha,
  classifyInbound,
  geoBonus,
  haversineKm,
  issueCaptcha,
  mapsProvider,
  renderWhatsApp,
  scorecardRow,
  statusReply,
} from "../src/lib/phase2";

describe("WhatsApp", () => {
  it("renders English and Hindi templates with the Comp. No", () => {
    const vars = { ticketNo: "OPL260101001", customerName: "Ramesh", engineer: "Amit", engineerPhone: "9811111111", scheduleDate: "tomorrow", otp: "445566", link: "https://oswal.test/track" };
    expect(renderWhatsApp("REGISTERED", "en", vars).body).toContain("OPL260101001");
    expect(renderWhatsApp("REGISTERED", "hi", vars).body).toContain("OPL260101001");
    expect(renderWhatsApp("ASSIGNED", "hi", vars).body).toContain("Amit");
    expect(renderWhatsApp("CLOSE_OTP", "en", vars).body).toContain("445566");
    expect(renderWhatsApp("SLA_APOLOGY", "en", vars).body.toLowerCase()).toContain("sorry");
  });

  it("classifies opt-out, a Comp. No and a mobile", () => {
    expect(classifyInbound("STOP").kind).toBe("optout");
    expect(classifyInbound("बंद").kind).toBe("optout");
    expect(classifyInbound("please see OPL260101044")).toEqual({ kind: "ticket", ticketNo: "OPL260101044" });
    expect(classifyInbound("+91 98123 45678")).toEqual({ kind: "phone", phone: "9812345678" });
    expect(classifyInbound("hello").kind).toBe("ignore");
  });

  it("stops a sixth message inside the hour", () => {
    expect(allowSend(4)).toBe(true);
    expect(allowSend(5)).toBe(false);
  });

  it("answers a status lookup in both languages", () => {
    expect(statusReply("en", { ticketNo: "OPL260101001", status: "Open", engineer: null })).toContain("Open");
    expect(statusReply("hi", { ticketNo: "OPL260101001", status: "Open", engineer: "Amit" })).toContain("Amit");
  });
});

describe("map score", () => {
  it("prefers a nearer technician and adds SLA risk", () => {
    const karnal = { lat: 29.6857, lng: 76.9905 };
    const near = haversineKm(karnal, { lat: 29.70, lng: 77.01 });
    const far = haversineKm(karnal, { lat: 28.61, lng: 77.21 });
    expect(near).toBeLessThan(far);
    expect(geoBonus(near, true).score).toBeGreaterThan(geoBonus(far, false).score);
    expect(mapsProvider(undefined)).toBe("osm");
    expect(mapsProvider("key")).toBe("google");
  });
});

describe("public form guards", () => {
  it("accepts a fresh captcha and rejects a wrong answer", () => {
    const issued = issueCaptcha("test-secret", 1_700_000_000_000);
    expect(checkCaptcha("test-secret", issued.token, issued.answer, 1_700_000_000_000)).toBe(true);
    expect(checkCaptcha("test-secret", issued.token, "0", 1_700_000_000_000)).toBe(false);
  });

  it("rate-limits a mobile after five attempts", () => {
    const now = 1_000_000;
    const stamps = [now - 10, now - 20, now - 30, now - 40, now - 50];
    expect(allowPublicAttempt(stamps, now).ok).toBe(false);
    expect(allowPublicAttempt([now - 2 * 60 * 60 * 1000], now).ok).toBe(true);
  });
});

describe("scorecards", () => {
  it("computes closure, first-time fix and repeat rates", () => {
    const row = scorecardRow({ closed: 8, tickets: 10, withinSla: 6, firstTime: 4, scored: 8, repeats: 2, feedback: 18, feedbackCount: 4, tatHours: 12.5 });
    expect(row.closureRate).toBe(80);
    expect(row.firstTimeFix).toBe(50);
    expect(row.repeatRate).toBe(20);
    expect(row.feedback).toBe(4.5);
    expect(row.tatHours).toBe(12.5);
  });
});
