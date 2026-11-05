import { describe, expect, it } from "vitest";
import { companyCodeForCategory } from "../src/lib/company-tag";

describe("company tagging", () => {
  it("tags every pump line, including KUSUM and solar pumps, as Oswal Pumps", () => {
    for (const name of [
      "Submersible Pump",
      "Monoblock",
      "PM-KUSUM",
      "KUSUM dealer",
      "Solar Pump",
      "Solar Submersible Pump",
      "Solar- Controller",
      "Motor",
      "RMS",
      "Controller",
      "5 HP Surface Pump",
    ]) {
      expect(companyCodeForCategory(name), name).toBe("PUMPS");
    }
  });

  it("tags only panels, modules, rooftop systems and inverters as Oswal Solar", () => {
    for (const name of ["Solar Panel", "Module", "Rooftop system", "String inverter", "Oswal Pumps - Module/Panel"]) {
      expect(companyCodeForCategory(name), name).toBe("SOLAR");
    }
  });
});
