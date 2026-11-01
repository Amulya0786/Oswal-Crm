/**
 * Extension points for later phases. Phase 1 does not call these.
 * Implement the interfaces and register them from the desk actions
 * (close, visit, stock issue) without rewriting the complaint model.
 */

export interface FieldVisit {
  complaintId: string;
  lat?: number;
  lng?: number;
  photoIds: string[];
  otp?: string;
  offlineClientId?: string;
}

export interface AttendancePort {
  checkIn(userId: string, at: Date, lat?: number, lng?: number): Promise<void>;
}

export interface ExpensePort {
  submit(userId: string, expenseTypeId: string, amount: number, note?: string): Promise<void>;
}

export interface StockPort {
  consume(serviceCenterId: string, sku: string, qty: number, complaintId?: string): Promise<void>;
}

export interface WarrantyPort {
  lookup(serialNumber: string): Promise<{ status: "IN_WARRANTY" | "AMC" | "OUT" | "UNKNOWN"; until?: string }>;
}

export interface DealerOrderPort {
  placeSpareRequest(dealerUserId: string, sku: string, qty: number): Promise<{ requestId: string }>;
}

export interface SchemeClaimPort {
  openClaim(complaintId: string, scheme: "MSEDCL" | "KUSUM"): Promise<{ claimId: string }>;
}

export interface BusinessCentralClient {
  pushClosedComplaint(ticketNumber: string): Promise<{ remoteId: string }>;
}
