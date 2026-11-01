export const ACTIONS = [
  "manageMasters",
  "manageUsers",
  "importData",
  "manageSla",
  "manageTemplates",
  "runEscalation",
  "book",
  "assign",
  "hold",
  "close",
  "happyCall",
  "cancel",
  "note",
  "visit",
  "attach",
  "viewReports",
  "exportReports",
] as const;

export type Action = (typeof ACTIONS)[number];

const MATRIX: Record<string, readonly Action[]> = {
  CALL_CENTRE: ["book", "assign", "hold", "happyCall", "cancel", "note", "attach", "viewReports", "exportReports"],
  AREA_MANAGER: ["book", "assign", "hold", "close", "note", "visit", "attach", "viewReports", "exportReports"],
  STATE_HEAD: ["book", "assign", "hold", "close", "cancel", "note", "visit", "attach", "viewReports", "exportReports"],
  TECHNICIAN: ["hold", "close", "note", "visit", "attach"],
  DEALER: ["book", "note"],
};

export function can(role: string, action: Action) {
  if (role === "ADMIN") return true;
  return (MATRIX[role] ?? []).includes(action);
}
