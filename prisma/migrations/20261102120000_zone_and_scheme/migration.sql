ALTER TABLE "State" ADD COLUMN "zone" TEXT;

CREATE TABLE "Scheme" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "Scheme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Scheme_name_key" ON "Scheme"("name");
