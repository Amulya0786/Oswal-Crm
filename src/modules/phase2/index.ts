import type { AttendancePort, ExpensePort, FieldVisit, StockPort, WarrantyPort } from "../contracts";

export type { FieldVisit };

export const attendance: AttendancePort = {
  async checkIn() {
    throw new Error("Attendance check-in arrives with the technician PWA in Phase 2.");
  },
};

export const expenses: ExpensePort = {
  async submit() {
    throw new Error("Expense claims arrive in Phase 2. Expense types are already maintained under Masters.");
  },
};

export const stock: StockPort = {
  async consume() {
    throw new Error("Spare-parts stock arrives in Phase 2.");
  },
};

export const warranty: WarrantyPort = {
  async lookup() {
    throw new Error("Warranty and AMC lookup arrives in Phase 2.");
  },
};
