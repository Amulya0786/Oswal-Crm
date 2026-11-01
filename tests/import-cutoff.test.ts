import { describe, expect, it } from "vitest";
import { suggestMapping } from "../src/lib/import-map";
import { parseLooseDate } from "../src/lib/time";
import {
  DEFAULT_HISTORY_CUTOFF,
  chunkRows,
  classifyHistoryDate,
  closedHistory,
  resolveHistoryCutoff,
  tallyHistory,
} from "../src/lib/import-cutoff";

const HEADERS = [
  "Sr.No", "Comp. No", "Book Date", "Customer Details", "Address", "Mobile No.", "Alternate Mobile No.",
  "Area/Block", "District", "State", "Pincode", "Call Type", "Category", "Product Details", "Nature of Complaint",
  "Schedule Date", "Assigned to", "Employee Code", "Status", "OEM/Brand Name", "Customer Remark", "Technician Remark",
  "Technician Action", "Pending Reason", "HP/Capacity", "Product Serial No.", "Saral Id", "Ageing", "FinalStatus",
  "CallBy", "Priority", "MSEDCLRequestNo.", "MSEDCLRequestStatus", "RequestSubtypeName", "Autoassignmentto",
  "Actual Problem Found", "Solution Provided", "Happy Code",
];

describe("history cutoff", () => {
  const cutoff = resolveHistoryCutoff(DEFAULT_HISTORY_CUTOFF);

  it("defaults to 1 April 2026 and keeps that day", () => {
    expect(DEFAULT_HISTORY_CUTOFF).toBe("2026-04-01");
    const bookDate = parseLooseDate("01-Apr-2026");
    expect(bookDate).not.toBeNull();
    expect(classifyHistoryDate("01-Apr-2026", cutoff)).toBe("keep");
    expect(classifyHistoryDate("1-April-2026", cutoff)).toBe("keep");
  });

  it("skips book dates before the cutoff and rows with no date", () => {
    expect(classifyHistoryDate("31-Mar-2026", cutoff)).toBe("before-cutoff");
    expect(classifyHistoryDate("01-Apr-2025", cutoff)).toBe("before-cutoff");
    expect(classifyHistoryDate("", cutoff)).toBe("no-date");
    const tally = tallyHistory(["31-Mar-2026", "01-Apr-2026", "15-Jun-2026", ""], cutoff);
    expect(tally).toEqual({ keep: 2, skipped: 1, undated: 1 });
  });

  it("accepts a later cutoff from configuration", () => {
    const later = resolveHistoryCutoff("2026-06-01");
    expect(classifyHistoryDate("01-May-2026", later)).toBe("before-cutoff");
    expect(classifyHistoryDate("01-Jun-2026", later)).toBe("keep");
  });

  it("treats Closed and Happy Calling Done as closed history", () => {
    expect(closedHistory("Closed")).toEqual({ status: "CLOSED", closed: true, happy: false });
    expect(closedHistory("Happy Calling Done")).toEqual({ status: "HAPPY_CALLING", closed: true, happy: true });
    expect(closedHistory("Open").closed).toBe(false);
  });

  it("maps the Smartlogics export columns and batches the file", () => {
    const mapping = suggestMapping(HEADERS);
    expect(mapping["Comp. No"]).toBe("ticketNo");
    expect(mapping["Book Date"]).toBe("bookDate");
    expect(mapping["Mobile No."]).toBe("phone");
    expect(mapping["Alternate Mobile No."]).toBe("altPhone");
    expect(mapping["Employee Code"]).toBe("employeeCode");
    expect(mapping["HP/Capacity"]).toBe("capacityLabel");
    expect(mapping["Product Serial No."]).toBe("serialNo");
    expect(mapping["MSEDCLRequestNo."]).toBe("msedclConsumerNo");
    expect(mapping["Actual Problem Found"]).toBe("actualProblem");
    expect(mapping["Solution Provided"]).toBe("actualSolution");
    expect(mapping["Happy Code"]).toBe("happyCode");
    expect(mapping["Sr.No"]).toBe("ignore");
    expect(mapping["Ageing"]).toBe("ignore");
    expect(chunkRows([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
