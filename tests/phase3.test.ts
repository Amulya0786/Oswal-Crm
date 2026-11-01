import { describe, expect, it } from "vitest";
import {
  aiMode,
  breachRisk,
  incentiveFor,
  parseQuestion,
  parseRating,
  performanceScore,
  ratingNeedsEscalation,
  suggestBooking,
  summariseTimeline,
  validateProof,
} from "../src/lib/phase3";

describe("feedback", () => {
  it("reads a 1 to 5 reply and escalates a low score", () => {
    expect(parseRating("4 Working well")).toEqual({ rating: 4, comment: "Working well" });
    expect(parseRating("2")).toEqual({ rating: 2, comment: "" });
    expect(parseRating("hello")).toBeNull();
    expect(ratingNeedsEscalation(2)).toBe(true);
    expect(ratingNeedsEscalation(1)).toBe(true);
    expect(ratingNeedsEscalation(3)).toBe(false);
  });
});

describe("closing proof", () => {
  it("asks for a photo, a signature or OTP, and GPS", () => {
    const missing = validateProof({ photos: 0, signature: false, otp: false }, { requirePhoto: true, requireIdentity: true, requireGps: true, maxKm: 15 });
    expect(missing.ok).toBe(false);
    expect(missing.missing).toEqual(["site photo", "signature or OTP", "GPS"]);
  });

  it("accepts a signature without an OTP and flags a far pin", () => {
    const near = validateProof({
      photos: 1, signature: true, otp: false, lat: 29.69, lng: 76.99, customerLat: 29.70, customerLng: 77.00,
    });
    expect(near.ok).toBe(true);
    expect(near.gpsFar).toBe(false);
    const far = validateProof({
      photos: 1, signature: false, otp: true, lat: 19.07, lng: 72.87, customerLat: 29.69, customerLng: 76.99,
    }, { requirePhoto: true, requireIdentity: true, requireGps: true, maxKm: 15 });
    expect(far.ok).toBe(true);
    expect(far.gpsFar).toBe(true);
    expect(far.distanceKm ?? 0).toBeGreaterThan(15);
  });
});

describe("technician score", () => {
  it("weights closures, time, repeats, feedback, proof and reopens", () => {
    const strong = performanceScore({ closures: 10, assigned: 10, tatHours: 24, slaHours: 48, repeats: 0, feedback: 5, proofOk: 10, closed: 10, reopened: 0 });
    const weak = performanceScore({ closures: 2, assigned: 10, tatHours: 96, slaHours: 48, repeats: 2, feedback: 2, proofOk: 0, closed: 2, reopened: 2 });
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(incentiveFor(strong.score)).toBeGreaterThan(incentiveFor(40));
    expect(incentiveFor(92)).toBe(2000);
    expect(incentiveFor(60)).toBe(500);
  });
});

describe("assistant mock", () => {
  it("suggests from Hindi or English and stays mock without a key", () => {
    expect(suggestBooking("कंट्रोलर चालू नहीं", false).category).toBe("Controller");
    expect(suggestBooking("same pump again", false).duplicate).toBe(true);
    expect(aiMode(undefined)).toBe("mock");
    expect(aiMode("sk-test")).toBe("live");
    expect(parseQuestion("pending solar controller complaints in Buldhana older than 7 days")).toMatchObject({
      pending: true, district: "Buldhana", days: 7, product: "solar",
    });
    expect(breachRisk({ ageHours: 40, slaHours: 48, repeat: false }).risk).toBe(true);
    expect(summariseTimeline(["Booked", "Assigned"])).toContain("Booked");
  });
});
