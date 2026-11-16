-- DropIndex

-- DropIndex

-- DropIndex

-- DropIndex

-- DropIndex

-- DropIndex

-- AlterTable
ALTER TABLE "Complaint" ADD COLUMN     "capacityLabel" TEXT,
ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'FIELD',
ADD COLUMN     "closureProof" TEXT,
ADD COLUMN     "duplicateOfTicket" TEXT,
ADD COLUMN     "duplicateOverrideReason" TEXT,
ADD COLUMN     "excludeFromMis" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "firstTimeFix" BOOLEAN,
ADD COLUMN     "headLabel" TEXT,
ADD COLUMN     "holdAt" TIMESTAMP(3),
ADD COLUMN     "holdCode" TEXT,
ADD COLUMN     "problemCategoryId" TEXT,
ADD COLUMN     "problemNote" TEXT,
ADD COLUMN     "secondaryCategories" TEXT,
ADD COLUMN     "serialNorm" TEXT,
ADD COLUMN     "solvedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Engineer" ADD COLUMN     "employeeCode" TEXT,
ADD COLUMN     "mergedIntoId" TEXT;

-- AlterTable
ALTER TABLE "HoldStatus" ADD COLUMN     "code" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DistrictAlias" (
    "alias" TEXT NOT NULL,
    "districtId" TEXT NOT NULL,

    CONSTRAINT "DistrictAlias_pkey" PRIMARY KEY ("alias")
);

-- CreateTable
CREATE TABLE "ProblemCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ProblemCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SerialUnit" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "productId" TEXT,
    "productName" TEXT,

    CONSTRAINT "SerialUnit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SpareRequest" (
    "id" TEXT NOT NULL,
    "complaintId" TEXT NOT NULL,
    "partName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "SpareRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DistrictAlias_districtId_idx" ON "DistrictAlias"("districtId");

-- CreateIndex
CREATE UNIQUE INDEX "ProblemCategory_name_key" ON "ProblemCategory"("name");

-- CreateIndex
CREATE INDEX "SerialUnit_serial_idx" ON "SerialUnit"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "SerialUnit_companyId_serial_key" ON "SerialUnit"("companyId", "serial");

-- CreateIndex
CREATE INDEX "SpareRequest_complaintId_status_idx" ON "SpareRequest"("complaintId", "status");

-- CreateIndex
CREATE INDEX "Complaint_excludeFromMis_status_idx" ON "Complaint"("excludeFromMis", "status");

-- CreateIndex
CREATE INDEX "Complaint_serialNorm_idx" ON "Complaint"("serialNorm");

-- CreateIndex
CREATE INDEX "Complaint_channel_status_idx" ON "Complaint"("channel", "status");

-- CreateIndex
CREATE INDEX "Complaint_solvedAt_idx" ON "Complaint"("solvedAt");

-- CreateIndex
CREATE INDEX "Complaint_holdCode_status_idx" ON "Complaint"("holdCode", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Engineer_employeeCode_key" ON "Engineer"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "HoldStatus_code_key" ON "HoldStatus"("code");

-- AddForeignKey
ALTER TABLE "DistrictAlias" ADD CONSTRAINT "DistrictAlias_districtId_fkey" FOREIGN KEY ("districtId") REFERENCES "District"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Engineer" ADD CONSTRAINT "Engineer_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "Engineer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_problemCategoryId_fkey" FOREIGN KEY ("problemCategoryId") REFERENCES "ProblemCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpareRequest" ADD CONSTRAINT "SpareRequest_complaintId_fkey" FOREIGN KEY ("complaintId") REFERENCES "Complaint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

