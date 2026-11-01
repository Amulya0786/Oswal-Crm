export const ROLES = [
  "ADMIN",
  "CALL_CENTRE",
  "AREA_MANAGER",
  "STATE_HEAD",
  "TECHNICIAN",
  "DEALER",
] as const;

export type Role = (typeof ROLES)[number];

export type CompanyBrief = {
  id: string;
  code: string;
  name: string;
  legalName: string;
  shortName: string;
  accent: string;
  logoText: string;
  tagline: string;
  phone: string | null;
  email: string | null;
};

export type Capabilities = {
  book: boolean;
  assign: boolean;
  close: boolean;
  happy: boolean;
  cancel: boolean;
  hold: boolean;
  note: boolean;
  reopen: boolean;
  masterWrite: boolean;
  masterView: boolean;
  security: boolean;
  report: boolean;
  import: boolean;
  settings: boolean;
  export: boolean;
  analytics: boolean;
  allCompanies: boolean;
};

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone: string | null;
  isTest: boolean;
  mustChangePassword: boolean;
  engineerId: string | null;
  companies: CompanyBrief[];
  companyIds: string[];
  stateIds: string[];
  districtIds: string[];
  brandIds: string[];
  caps: Capabilities;
};

export type ComplaintFilters = {
  q?: string;
  status?: string;
  statusGroup?: string;
  callType?: string;
  stateId?: string;
  districtId?: string;
  engineerId?: string;
  productId?: string;
  brandId?: string;
  priority?: string;
  source?: string;
  companyId?: string;
  scheme?: string;
  from?: string;
  to?: string;
  booked?: string;
  closed?: string;
  happy?: string;
  cancelled?: string;
  ageing?: string;
  breach?: string;
  risk?: string;
  repeat?: string;
  serialPending?: string;
  asOf?: string;
  channel?: string;
  includeTest?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: string;
};
