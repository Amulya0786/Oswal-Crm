-- Customer identity, installed assets, and repeat links.
ALTER TABLE "Customer" ADD COLUMN "phoneNorm" TEXT;
ALTER TABLE "Customer" ADD COLUMN "nameNorm" TEXT;
ALTER TABLE "Customer" ADD COLUMN "village" TEXT;
ALTER TABLE "Customer" ADD COLUMN "mergedIntoId" TEXT;

UPDATE "Customer"
SET "phoneNorm" = CASE
      WHEN length(regexp_replace("phone", '\D', '', 'g')) >= 10
        THEN right(regexp_replace("phone", '\D', '', 'g'), 10)
      ELSE NULLIF(regexp_replace("phone", '\D', '', 'g'), '')
    END,
    "nameNorm" = lower(btrim(regexp_replace("name", '\s+', ' ', 'g')));

CREATE UNIQUE INDEX "Customer_phoneNorm_key" ON "Customer"("phoneNorm");
CREATE INDEX "Customer_nameNorm_pincode_idx" ON "Customer"("nameNorm", "pincode");
CREATE INDEX "Customer_mergedIntoId_idx" ON "Customer"("mergedIntoId");

ALTER TABLE "Customer" ADD CONSTRAINT "Customer_mergedIntoId_fkey"
  FOREIGN KEY ("mergedIntoId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CustomerPhone" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "phoneNorm" TEXT NOT NULL,
  CONSTRAINT "CustomerPhone_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CustomerPhone_phoneNorm_key" ON "CustomerPhone"("phoneNorm");
CREATE INDEX "CustomerPhone_customerId_idx" ON "CustomerPhone"("customerId");
ALTER TABLE "CustomerPhone" ADD CONSTRAINT "CustomerPhone_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Asset" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT,
  "productName" TEXT,
  "modelName" TEXT,
  "serialNorm" TEXT,
  "capacityLabel" TEXT,
  "identityKey" TEXT NOT NULL,
  "installedAt" TIMESTAMP(3),
  "warrantyUntil" TIMESTAMP(3),
  "amcUntil" TIMESTAMP(3),
  CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Asset_identityKey_key" ON "Asset"("identityKey");
CREATE INDEX "Asset_customerId_idx" ON "Asset"("customerId");
CREATE INDEX "Asset_serialNorm_idx" ON "Asset"("serialNorm");
CREATE INDEX "Asset_productId_idx" ON "Asset"("productId");
CREATE INDEX "Asset_companyId_idx" ON "Asset"("companyId");
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_productId_fkey"
  FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Complaint" ADD COLUMN "repeatOfTicket" TEXT;
ALTER TABLE "Complaint" ADD COLUMN "repeatWindow" INTEGER;
ALTER TABLE "Complaint" ADD COLUMN "assetId" TEXT;
CREATE INDEX "Complaint_assetId_bookDate_idx" ON "Complaint"("assetId", "bookDate");
CREATE INDEX "Complaint_repeatOfTicket_idx" ON "Complaint"("repeatOfTicket");
CREATE INDEX "Complaint_repeatWindow_idx" ON "Complaint"("repeatWindow");
ALTER TABLE "Complaint" ADD CONSTRAINT "Complaint_assetId_fkey"
  FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
