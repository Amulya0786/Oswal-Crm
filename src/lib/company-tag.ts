export type CompanyCode = "PUMPS" | "SOLAR";

/**
 * Oswal Pumps owns every pump complaint: PM-KUSUM and other solar pumps,
 * KUSUM dealers, submersible, monoblock, motors, controllers and RMS.
 * Oswal Solar owns only non-pump solar equipment: panels, modules, rooftop systems and inverters.
 */
export function companyCodeForCategory(name: string | null | undefined): CompanyCode {
  const text = (name ?? "").toLowerCase();
  const nonPumpSolar = /\b(panels?|modules?|rooftops?|inverters?)\b/.test(text);
  const pumpGear = /\b(submersibles?|monoblocks?|mono[\s-]?blocks?|openwells?|jets?|motors?|controllers?|rms|kusum|surface pumps?|solar pumps?)\b/.test(text)
    || (/\bpumps?\b/.test(text) && !nonPumpSolar);
  if (nonPumpSolar && !pumpGear) return "SOLAR";
  return "PUMPS";
}
