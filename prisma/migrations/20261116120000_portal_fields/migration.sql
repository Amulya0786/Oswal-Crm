-- Portal complaint number, portal status, and a flag when GPS was saved with no site pin.
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "portalNo" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "portalStatus" TEXT;
ALTER TABLE "Complaint" ADD COLUMN IF NOT EXISTS "gpsSiteUnknown" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Complaint_portal_idx" ON "Complaint" ("portal");
CREATE INDEX IF NOT EXISTS "Complaint_portalNo_idx" ON "Complaint" ("portalNo");

-- Explicit "direct" stays direct and is not overwritten by later guesses.
UPDATE "Complaint"
SET portal = 'NONE'
WHERE portal IS NOT NULL
  AND lower(btrim(portal)) IN ('none', 'direct', 'none/direct', 'none / direct', 'call', 'n/a', 'na');

UPDATE "Complaint" SET portal = 'HAREDA'
WHERE COALESCE(portal, '') NOT IN ('NONE', 'HAREDA', 'MSEDCL', 'MEDA', 'KREDL', 'PM_KUSUM')
  AND (
    COALESCE(portal, '') ILIKE '%hareda%'
    OR COALESCE("schemeName", '') ILIKE '%hareda%'
    OR COALESCE(source, '') ILIKE '%hareda%'
    OR COALESCE("requestSubtype", '') ILIKE '%hareda%'
    OR COALESCE("subType", '') ILIKE '%hareda%'
  );

UPDATE "Complaint" SET portal = 'MEDA'
WHERE COALESCE(portal, '') NOT IN ('NONE', 'HAREDA', 'MSEDCL', 'MEDA', 'KREDL', 'PM_KUSUM')
  AND (
    COALESCE(portal, '') ILIKE '%meda%'
    OR COALESCE("schemeName", '') ILIKE '%meda%'
    OR COALESCE(source, '') ILIKE '%meda%'
    OR COALESCE("requestSubtype", '') ILIKE '%meda%'
    OR COALESCE("subType", '') ILIKE '%meda%'
  );

UPDATE "Complaint" SET portal = 'KREDL'
WHERE COALESCE(portal, '') NOT IN ('NONE', 'HAREDA', 'MSEDCL', 'MEDA', 'KREDL', 'PM_KUSUM')
  AND (
    COALESCE(portal, '') ILIKE '%kredl%'
    OR COALESCE("schemeName", '') ILIKE '%kredl%'
    OR COALESCE(source, '') ILIKE '%kredl%'
    OR COALESCE("requestSubtype", '') ILIKE '%kredl%'
    OR COALESCE("subType", '') ILIKE '%kredl%'
  );

UPDATE "Complaint" SET portal = 'MSEDCL'
WHERE COALESCE(portal, '') NOT IN ('NONE', 'HAREDA', 'MSEDCL', 'MEDA', 'KREDL', 'PM_KUSUM')
  AND (
    COALESCE(portal, '') ILIKE '%msedcl%'
    OR COALESCE("schemeName", '') ILIKE '%msedcl%'
    OR COALESCE(source, '') ILIKE '%msedcl%'
    OR COALESCE("requestSubtype", '') ILIKE '%msedcl%'
    OR COALESCE("subType", '') ILIKE '%msedcl%'
  );

UPDATE "Complaint" SET portal = 'PM_KUSUM'
WHERE COALESCE(portal, '') NOT IN ('NONE', 'HAREDA', 'MSEDCL', 'MEDA', 'KREDL', 'PM_KUSUM')
  AND (
    COALESCE(portal, '') ILIKE '%pm-kusum%'
    OR COALESCE(portal, '') ILIKE '%pm kusum%'
    OR COALESCE("schemeName", '') ILIKE '%pm-kusum%'
    OR COALESCE("schemeName", '') ILIKE '%pm kusum%'
    OR COALESCE(source, '') ILIKE '%pm-kusum%'
    OR COALESCE(source, '') ILIKE '%pm kusum%'
  );

-- MSEDCL columns are specific to that portal.
UPDATE "Complaint" SET portal = 'MSEDCL'
WHERE portal IS NULL
  AND (
    NULLIF(btrim(COALESCE("msedclRequestNo", '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE("msedclStatus", '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE("msedclConsumerNo", '')), '') IS NOT NULL
    OR NULLIF(btrim(COALESCE("msedclSubdivision", '')), '') IS NOT NULL
  );

-- State plus a scheme signal. Maharashtra is left unset (MSEDCL and MEDA both apply).
UPDATE "Complaint" SET portal = 'HAREDA'
WHERE portal IS NULL
  AND COALESCE("stateName", '') ILIKE '%haryana%'
  AND (
    NULLIF(btrim(COALESCE("schemeName", '')), '') IS NOT NULL
    OR "callType" = 'SCHEME'
    OR NULLIF(btrim(COALESCE("saralId", '')), '') IS NOT NULL
  );

UPDATE "Complaint" SET portal = 'KREDL'
WHERE portal IS NULL
  AND COALESCE("stateName", '') ILIKE '%karnataka%'
  AND (
    NULLIF(btrim(COALESCE("schemeName", '')), '') IS NOT NULL
    OR "callType" = 'SCHEME'
    OR NULLIF(btrim(COALESCE("saralId", '')), '') IS NOT NULL
  );

UPDATE "Complaint"
SET "portalNo" = NULLIF(btrim("msedclRequestNo"), '')
WHERE portal = 'MSEDCL'
  AND "portalNo" IS NULL
  AND NULLIF(btrim(COALESCE("msedclRequestNo", '')), '') IS NOT NULL;

UPDATE "Complaint"
SET "portalStatus" = NULLIF(btrim("msedclStatus"), '')
WHERE portal = 'MSEDCL'
  AND "portalStatus" IS NULL
  AND NULLIF(btrim(COALESCE("msedclStatus", '')), '') IS NOT NULL;

DO $$
DECLARE
  n_hareda int; n_msedcl int; n_meda int; n_kredl int; n_kusum int; n_direct int; n_unknown int;
BEGIN
  SELECT count(*) INTO n_hareda FROM "Complaint" WHERE portal = 'HAREDA';
  SELECT count(*) INTO n_msedcl FROM "Complaint" WHERE portal = 'MSEDCL';
  SELECT count(*) INTO n_meda FROM "Complaint" WHERE portal = 'MEDA';
  SELECT count(*) INTO n_kredl FROM "Complaint" WHERE portal = 'KREDL';
  SELECT count(*) INTO n_kusum FROM "Complaint" WHERE portal = 'PM_KUSUM';
  SELECT count(*) INTO n_direct FROM "Complaint" WHERE portal = 'NONE';
  SELECT count(*) INTO n_unknown FROM "Complaint" WHERE portal IS NULL;
  RAISE NOTICE 'portal backfill HAREDA=% MSEDCL=% MEDA=% KREDL=% PM_KUSUM=% NONE=% unknown=%',
    n_hareda, n_msedcl, n_meda, n_kredl, n_kusum, n_direct, n_unknown;
END $$;
