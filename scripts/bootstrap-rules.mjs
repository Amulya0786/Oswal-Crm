/** Shared by the start script and the tests. No database access. */

export const COMPANIES = [
  {
    code: "PUMPS",
    name: "Oswal Pumps",
    legalName: "Oswal Pumps Ltd",
    shortName: "Oswal Pumps",
    accent: "#02502f",
    logoText: "OP",
    tagline: "Pumps and motors",
  },
  {
    code: "SOLAR",
    name: "Oswal Solar",
    legalName: "Oswal Solar Energy",
    shortName: "Oswal Solar",
    accent: "#FFC61A",
    logoText: "OS",
    tagline: "Panels and inverters",
  },
];

export const SLA_HOURS = {
  BREAKDOWN: 48,
  INSTALLATION: 120,
  INSURANCE: 168,
  MOBILE_APP: 72,
  SCHEME: 240,
};

export const PROOF_DEFAULT = {
  requirePhoto: true,
  requireIdentity: true,
  requireGps: true,
  maxKm: 15,
};

export function newPasswordError(next, sameAsCurrent) {
  if (!next || next.length < 8) return "Use at least 8 characters";
  if (sameAsCurrent) return "Choose a different password";
  return null;
}

/** Missing env is an error only when the database has no users yet. */
export function adminBootstrapError(userCount, email, password) {
  if (userCount > 0) return null;
  const address = (email ?? "").trim().toLowerCase();
  if (!address || !address.includes("@")) return "Set ADMIN_EMAIL before the first start";
  return newPasswordError(password ?? "", false);
}
