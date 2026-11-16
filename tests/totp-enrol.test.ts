import { afterEach, describe, expect, it } from "vitest";
import { mustEnrolTotp } from "../src/server/auth";

const previousEnforce = process.env.ADMIN_2FA_ENFORCE;
const previousGrace = process.env.ADMIN_2FA_GRACE_UNTIL;

afterEach(() => {
  if (previousEnforce === undefined) delete process.env.ADMIN_2FA_ENFORCE;
  else process.env.ADMIN_2FA_ENFORCE = previousEnforce;
  if (previousGrace === undefined) delete process.env.ADMIN_2FA_GRACE_UNTIL;
  else process.env.ADMIN_2FA_GRACE_UNTIL = previousGrace;
});

describe("authenticator enrolment", () => {
  it("stays off for every role unless enforcement is set to 1", () => {
    delete process.env.ADMIN_2FA_ENFORCE;
    delete process.env.ADMIN_2FA_GRACE_UNTIL;
    expect(mustEnrolTotp("ADMIN", false)).toBe(false);
    expect(mustEnrolTotp("STATE_HEAD", false)).toBe(false);
    expect(mustEnrolTotp("CALL_CENTRE", false)).toBe(false);
    expect(mustEnrolTotp("ADMIN", true)).toBe(false);
    process.env.ADMIN_2FA_ENFORCE = "0";
    expect(mustEnrolTotp("ADMIN", false)).toBe(false);
    process.env.ADMIN_2FA_ENFORCE = "1";
    expect(mustEnrolTotp("ADMIN", false)).toBe(true);
    expect(mustEnrolTotp("STATE_HEAD", false)).toBe(true);
    expect(mustEnrolTotp("CALL_CENTRE", false)).toBe(false);
    expect(mustEnrolTotp("ADMIN", true)).toBe(false);
    process.env.ADMIN_2FA_GRACE_UNTIL = new Date(Date.now() + 60_000).toISOString();
    expect(mustEnrolTotp("ADMIN", false)).toBe(false);
    process.env.ADMIN_2FA_GRACE_UNTIL = new Date(Date.now() - 60_000).toISOString();
    expect(mustEnrolTotp("STATE_HEAD", false)).toBe(true);
  });
});
