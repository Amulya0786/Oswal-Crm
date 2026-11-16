/** Canonical portal tag stored on Complaint.portal. NONE is a direct call, not a portal ticket. */
export const PORTALS = [
  { id: "NONE", label: "None / Direct" },
  { id: "HAREDA", label: "HAREDA" },
  { id: "MSEDCL", label: "MSEDCL" },
  { id: "MEDA", label: "MEDA" },
  { id: "KREDL", label: "KREDL" },
  { id: "PM_KUSUM", label: "PM-KUSUM" },
] as const;

export type PortalId = (typeof PORTALS)[number]["id"];

const KNOWN = new Set<string>(PORTALS.map((item) => item.id));

export function portalLabel(id: string | null | undefined) {
  if (!id) return "—";
  return PORTALS.find((item) => item.id === id)?.label ?? id;
}

export function isPortalTicket(portal: string | null | undefined) {
  return Boolean(portal && portal !== "NONE" && KNOWN.has(portal));
}

/** Map a typed or imported value onto a portal code. Empty stays unset. */
export function normalizePortal(value: string | null | undefined): PortalId | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const compact = text.toUpperCase().replace(/[\s._-]+/g, "");
  if (compact === "NONE" || compact === "DIRECT" || compact === "NONEDIRECT" || compact === "NA" || compact === "N/A") return "NONE";
  if (compact.includes("HAREDA")) return "HAREDA";
  if (compact.includes("MSEDCL")) return "MSEDCL";
  if (compact.includes("MEDA")) return "MEDA";
  if (compact.includes("KREDL")) return "KREDL";
  if (compact.includes("PMKUSUM")) return "PM_KUSUM";
  if (KNOWN.has(text.toUpperCase())) return text.toUpperCase() as PortalId;
  return null;
}

export type PortalHints = {
  portal?: string | null;
  schemeName?: string | null;
  source?: string | null;
  requestSubtype?: string | null;
  subType?: string | null;
  stateName?: string | null;
  callType?: string | null;
  saralId?: string | null;
  msedclRequestNo?: string | null;
  msedclStatus?: string | null;
  msedclConsumerNo?: string | null;
  msedclSubdivision?: string | null;
};

function blob(input: PortalHints) {
  return [input.portal, input.schemeName, input.source, input.requestSubtype, input.subType].filter(Boolean).join(" ");
}

/**
 * Safe inference only. Maharashtra is left unset because MSEDCL and MEDA both sit there.
 * A bare "KUSUM" is not enough. Unknown stays null.
 */
export function inferPortal(input: PortalHints): PortalId | null {
  const explicit = normalizePortal(input.portal);
  if (explicit) return explicit;
  const text = blob({ ...input, portal: null });
  const fromText = normalizePortal(text);
  if (fromText && fromText !== "NONE") return fromText;
  const msedcl = [input.msedclRequestNo, input.msedclStatus, input.msedclConsumerNo, input.msedclSubdivision].some((item) => String(item ?? "").trim());
  if (msedcl) return "MSEDCL";
  const state = String(input.stateName ?? "").toLowerCase();
  const schemeish = Boolean(String(input.schemeName ?? "").trim() || input.callType === "SCHEME" || String(input.saralId ?? "").trim());
  if (schemeish && state.includes("haryana")) return "HAREDA";
  if (schemeish && state.includes("karnataka")) return "KREDL";
  return null;
}
