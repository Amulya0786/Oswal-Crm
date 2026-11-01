import * as xlsx from "xlsx";

function sheet(rows: Record<string, string>[]) {
  return xlsx.utils.json_to_sheet(rows);
}

export function buildSampleWorkbook() {
  const book = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(
    book,
    sheet([
      {
        "Complaint No": "SL-24001",
        "Call Date": "2026-10-18",
        Customer: "Balwinder Kaur",
        "Mobile No": "9811191001",
        "Serial Number": "OSW-IMP-1001",
        Product: "Oswal V4 Submersible 1 HP",
        "Call Type": "Breakdown",
        "Complaint Source": "Call",
        Problem: "Low water discharge",
        "State Name": "Haryana",
        "District Name": "Karnal",
        Pincode: "132001",
        Narration: "Discharge dropped after the monsoon. Farmer reports the pump runs but the tank fills slowly.",
        Status: "Open",
        Scheme: "",
      },
      {
        "Complaint No": "SL-24002",
        "Call Date": "2026-10-22",
        Customer: "Santosh Yadav",
        "Mobile No": "9811191002",
        "Serial Number": "OSW-IMP-1002",
        Product: "OSP-V4-100",
        "Call Type": "Installation",
        "Complaint Source": "WhatsApp",
        Problem: "Installation schedule",
        "State Name": "Uttar Pradesh",
        "District Name": "Lucknow",
        Pincode: "226001",
        Narration: "New borewell ready. Customer asked for installation this week.",
        Status: "Assigned",
        Scheme: "",
      },
      {
        "Complaint No": "SL-24003",
        "Call Date": "2026-10-11",
        Customer: "Mahesh Patil",
        "Mobile No": "9811191003",
        "Serial Number": "OSW-IMP-1003",
        Product: "Oswal Solar Submersible 3 HP",
        "Call Type": "MSEDCL",
        "Complaint Source": "Dealer",
        Problem: "Scheme document pending",
        "State Name": "Maharashtra",
        "District Name": "Pune",
        Pincode: "411001",
        Narration: "MSEDCL beneficiary file missing the pump serial page.",
        Status: "Pending",
        Scheme: "MSEDCL",
      },
      {
        "Complaint No": "SL-24004",
        "Call Date": "2026-09-30",
        Customer: "Farida Khan",
        "Mobile No": "9811191004",
        "Serial Number": "OSW-IMP-1004",
        Product: "Oswal Monoblock 1 HP",
        "Call Type": "Insurance",
        "Complaint Source": "Web Form",
        Problem: "Insurance inspection",
        "State Name": "Haryana",
        "District Name": "Hisar",
        Pincode: "125001",
        Narration: "Burnt motor under the dealer insurance cover.",
        Status: "Closed",
        Scheme: "",
      },
      {
        "Complaint No": "SL-24005",
        "Call Date": "2026-10-05",
        Customer: "Nitin Joshi",
        "Mobile No": "9811191005",
        "Serial Number": "OSW-IMP-1005",
        Product: "Oswal Monoblock 1.5 HP",
        "Call Type": "Mobile App",
        "Complaint Source": "QR Link",
        Problem: "Mobile app login failure",
        "State Name": "Maharashtra",
        "District Name": "Nagpur",
        Pincode: "440001",
        Narration: "QR on the pump opens the app but the OTP never arrives.",
        Status: "Cancelled",
        Scheme: "",
      },
      {
        "Complaint No": "SL-24006",
        "Call Date": "2026-10-28",
        Customer: "Gurmeet Singh",
        "Mobile No": "9811191006",
        "Serial Number": "OSW-IMP-1006",
        Product: "Oswal Solar Submersible 2 HP",
        "Call Type": "KUSUM",
        "Complaint Source": "Call",
        Problem: "Beneficiary mismatch",
        "State Name": "Haryana",
        "District Name": "Karnal",
        Pincode: "132117",
        Narration: "KUSUM portal name does not match the Aadhaar name on the file.",
        Status: "Re-Assigned",
        Scheme: "KUSUM",
      },
    ]),
    "Complaints",
  );
  xlsx.utils.book_append_sheet(
    book,
    sheet([
      { Name: "Balwinder Kaur", Mobile: "9811191001", Email: "balwinder.kaur.demo@example.com", Village: "Gharaunda", State: "Haryana", District: "Karnal", Pincode: "132001", Address: "Near grain market", "Serial Number": "OSW-IMP-1001" },
      { Name: "Santosh Yadav", Mobile: "9811191002", Email: "", Village: "Gomti Nagar", State: "Uttar Pradesh", District: "Lucknow", Pincode: "226001", Address: "Lane 4", "Serial Number": "OSW-IMP-1002" },
      { Name: "Imported Farmer", Mobile: "9811191099", Email: "farmer.demo@example.com", Village: "Nilokheri", State: "Haryana", District: "Karnal", Pincode: "132117", Address: "Canal road", "Serial Number": "OSW-IMP-1099" },
    ]),
    "Customers",
  );
  xlsx.utils.book_append_sheet(
    book,
    sheet([
      { SKU: "OSP-V4-100", "Product Name": "Oswal V4 Submersible 1 HP", Family: "Submersible", Brand: "Oswal", Category: "Submersible", HSN: "84137010", HP: "1 HP", Head: "45 m", "Warranty Months": "18" },
      { SKU: "OSP-DEMO-900", "Product Name": "Oswal Demo Monoblock 1 HP", Family: "Monoblock", Brand: "Oswal", Category: "Monoblock", HSN: "84137010", HP: "1 HP", Head: "30 m", "Warranty Months": "12" },
    ]),
    "Products",
  );
  xlsx.utils.book_append_sheet(
    book,
    sheet([
      { Name: "Desk Import", Email: "import.desk@oswalpumps.local", Role: "Call Centre", Mobile: "9811191800", "Employee Code": "OPL-IMP-01", State: "Haryana", District: "Karnal", Brand: "Oswal" },
    ]),
    "Users",
  );
  return xlsx.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
