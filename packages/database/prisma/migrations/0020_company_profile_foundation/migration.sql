-- COMP-PROFILE01: editable company profile for invoice headers

ALTER TABLE "companies"
  ADD COLUMN "legalName" TEXT,
  ADD COLUMN "phone" TEXT,
  ADD COLUMN "billingEmail" TEXT,
  ADD COLUMN "primaryContactName" TEXT,
  ADD COLUMN "addressLine1" TEXT,
  ADD COLUMN "addressLine2" TEXT,
  ADD COLUMN "city" TEXT,
  ADD COLUMN "stateRegion" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "country" TEXT;
