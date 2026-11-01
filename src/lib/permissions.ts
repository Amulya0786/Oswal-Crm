export type AccessUser = {
  id: string;
  role: string;
  stateIds: string[];
  districtIds: string[];
  brandIds: string[];
};

export type ComplaintScope = {
  stateId?: string | null;
  districtId?: string | null;
  brandId?: string | null;
  assignedToUserId?: string | null;
};

export function canSeeComplaint(user: AccessUser, complaint: ComplaintScope) {
  if (user.role === "ADMIN") return true;
  if (user.role === "TECHNICIAN") return complaint.assignedToUserId === user.id;
  if (user.stateIds.length === 0) return false;
  if (!complaint.stateId || !user.stateIds.includes(complaint.stateId)) return false;
  if (user.districtIds.length > 0 && (!complaint.districtId || !user.districtIds.includes(complaint.districtId))) {
    return false;
  }
  if (user.brandIds.length > 0 && (!complaint.brandId || !user.brandIds.includes(complaint.brandId))) {
    return false;
  }
  return true;
}
