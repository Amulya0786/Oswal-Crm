ALTER TABLE "Engineer" ADD COLUMN "homeLat" DOUBLE PRECISION;
ALTER TABLE "Engineer" ADD COLUMN "homeLng" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN "lat" DOUBLE PRECISION;
ALTER TABLE "Complaint" ADD COLUMN "lng" DOUBLE PRECISION;

CREATE TABLE "WhatsAppOptOut" (
  "phoneNorm" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "source" TEXT,
  CONSTRAINT "WhatsAppOptOut_pkey" PRIMARY KEY ("phoneNorm")
);

CREATE TABLE "TechPing" (
  "id" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TechPing_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "TechPing_engineerId_at_idx" ON "TechPing"("engineerId", "at");
ALTER TABLE "TechPing" ADD CONSTRAINT "TechPing_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "Engineer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "VisitCheck" (
  "id" TEXT NOT NULL,
  "complaintId" TEXT NOT NULL,
  "engineerId" TEXT,
  "kind" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VisitCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "VisitCheck_complaintId_at_idx" ON "VisitCheck"("complaintId", "at");
ALTER TABLE "VisitCheck" ADD CONSTRAINT "VisitCheck_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FieldMedia" (
  "id" TEXT NOT NULL,
  "complaintId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "note" TEXT,
  "path" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldMedia_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "FieldMedia_complaintId_kind_idx" ON "FieldMedia"("complaintId", "kind");
ALTER TABLE "FieldMedia" ADD CONSTRAINT "FieldMedia_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AttendancePunch" (
  "id" TEXT NOT NULL,
  "engineerId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "lat" DOUBLE PRECISION,
  "lng" DOUBLE PRECISION,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AttendancePunch_engineerId_at_idx" ON "AttendancePunch"("engineerId", "at");
ALTER TABLE "AttendancePunch" ADD CONSTRAINT "AttendancePunch_engineerId_fkey" FOREIGN KEY ("engineerId") REFERENCES "Engineer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "SparePart" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "sku" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "SparePart_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SparePart_name_key" ON "SparePart"("name");

CREATE TABLE "CallLog" (
  "id" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "complaintId" TEXT,
  "direction" TEXT NOT NULL DEFAULT 'IN',
  "note" TEXT,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CallLog_phone_at_idx" ON "CallLog"("phone", "at");
CREATE INDEX "CallLog_complaintId_idx" ON "CallLog"("complaintId");
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
