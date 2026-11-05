-- Pincode.blockId points at the tehsil (block) in the same district.
-- Customer.phoneNorm stays globally unique so booking dedupe still finds one person.
ALTER TABLE "Pincode" ADD COLUMN IF NOT EXISTS "blockId" TEXT;
CREATE INDEX IF NOT EXISTS "Pincode_blockId_idx" ON "Pincode"("blockId");
CREATE INDEX IF NOT EXISTS "Tehsil_lgdCode_idx" ON "Tehsil"("lgdCode");
COMMENT ON COLUMN "Customer"."phoneNorm" IS 'One person across Pumps and Solar. Import reuses this row instead of creating a second customer.';
