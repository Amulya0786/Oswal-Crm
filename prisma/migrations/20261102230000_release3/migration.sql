-- Release 3. Additive only: new columns and tables. No drops or renames.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "failedLogins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpSecret" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetTokenHash" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "resetExpires" TIMESTAMP(3);

ALTER TABLE "District" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "District" ADD COLUMN IF NOT EXISTS "mergedIntoId" TEXT;
ALTER TABLE "District" ADD COLUMN IF NOT EXISTS "lgdCode" TEXT;
CREATE INDEX IF NOT EXISTS "District_mergedIntoId_idx" ON "District"("mergedIntoId");

ALTER TABLE "Area" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Engineer" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "Engineer" ADD COLUMN IF NOT EXISTS "signaturePath" TEXT;
ALTER TABLE "Engineer" ADD COLUMN IF NOT EXISTS "brandId" TEXT;
CREATE INDEX IF NOT EXISTS "Engineer_stateId_idx" ON "Engineer"("stateId");

ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "purchaseDate" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "portal" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "subType" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "msedclRequestNo" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "msedclStatus" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "requestSubtype" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "msedclVideoUrl" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "qaFlag" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "callbackDueAt" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "tehsilId" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "cityId" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "serviceCharge" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "spareCharge" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "paymentNote" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "suggestedEngineerId" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "suggestedName" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "offeredAt" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "seniorReview" BOOLEAN NOT NULL DEFAULT false;
CREATE UNIQUE INDEX IF NOT EXISTS "Complaint_idempotencyKey_key" ON "Complaint"("idempotencyKey");

ALTER TABLE "SlaPolicy" ADD COLUMN IF NOT EXISTS "callbackHours" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "OtpChallenge" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "PlaceAlias" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "stateName" TEXT NOT NULL,
  "alias" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  CONSTRAINT "PlaceAlias_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PlaceAlias_kind_stateName_alias_key" ON "PlaceAlias"("kind", "stateName", "alias");
CREATE INDEX IF NOT EXISTS "PlaceAlias_districtId_idx" ON "PlaceAlias"("districtId");

CREATE TABLE IF NOT EXISTS "Tehsil" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "lgdCode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "Tehsil_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Tehsil_districtId_name_key" ON "Tehsil"("districtId", "name");
CREATE INDEX IF NOT EXISTS "Tehsil_districtId_idx" ON "Tehsil"("districtId");

CREATE TABLE IF NOT EXISTS "City" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  "kind" TEXT,
  "pincodes" TEXT NOT NULL DEFAULT '',
  "lgdCode" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "City_districtId_name_key" ON "City"("districtId", "name");
CREATE INDEX IF NOT EXISTS "City_districtId_idx" ON "City"("districtId");

CREATE TABLE IF NOT EXISTS "EngineerDistrict" (
  "engineerId" TEXT NOT NULL,
  "districtId" TEXT NOT NULL,
  CONSTRAINT "EngineerDistrict_pkey" PRIMARY KEY ("engineerId", "districtId")
);

CREATE TABLE IF NOT EXISTS "EngineerStateHistory" (
  "id" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "stateId" TEXT,
  "from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  CONSTRAINT "EngineerStateHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "EngineerStateHistory_engineerId_from_idx" ON "EngineerStateHistory"("engineerId", "from");

CREATE TABLE IF NOT EXISTS "LeaveRequest" (
  "id" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "from" TIMESTAMP(3) NOT NULL,
  "to" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "LeaveRequest_engineerId_status_idx" ON "LeaveRequest"("engineerId", "status");

CREATE TABLE IF NOT EXISTS "ExpenseClaim" (
  "id" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "complaintId" TEXT,
  "type" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "detail" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ExpenseClaim_engineerId_at_idx" ON "ExpenseClaim"("engineerId", "at");

CREATE TABLE IF NOT EXISTS "ServiceContract" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT,
  "assetId" TEXT,
  "productName" TEXT,
  "start" TIMESTAMP(3) NOT NULL,
  "end" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceContract_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ServiceContract_end_status_idx" ON "ServiceContract"("end", "status");
CREATE INDEX IF NOT EXISTS "ServiceContract_companyId_idx" ON "ServiceContract"("companyId");

CREATE TABLE IF NOT EXISTS "DeskAlert" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "complaintId" TEXT,
  "stateId" TEXT,
  "engineerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "DeskAlert_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "DeskAlert_stateId_readAt_idx" ON "DeskAlert"("stateId", "readAt");
CREATE INDEX IF NOT EXISTS "DeskAlert_kind_createdAt_idx" ON "DeskAlert"("kind", "createdAt");

-- 24-hour customer promise where a due date was never stored. Does not overwrite dates already set.
UPDATE "Complaint"
SET "callbackDueAt" = "bookDate" + interval '24 hours'
WHERE "callbackDueAt" IS NULL;

UPDATE "Complaint"
SET "slaHours" = CASE "callType"
  WHEN 'INSTALLATION' THEN 120
  WHEN 'INSURANCE' THEN 168
  WHEN 'MOBILE_APP' THEN 72
  WHEN 'SCHEME' THEN 240
  ELSE 48 END
WHERE "slaHours" IS NULL;

UPDATE "Complaint"
SET "slaDueAt" = "bookDate" + ("slaHours" * interval '1 hour')
WHERE "slaDueAt" IS NULL AND status IN ('OPEN','ASSIGNED','REASSIGNED','PENDING');

ALTER TABLE "ReportKey" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "ReportKey" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "ReportKey" ADD COLUMN IF NOT EXISTS "stateId" TEXT;
ALTER TABLE "ReportKey" ADD COLUMN IF NOT EXISTS "brandId" TEXT;
ALTER TABLE "LoginHistory" ADD COLUMN IF NOT EXISTS "note" TEXT;
ALTER TABLE "Brand" ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;
