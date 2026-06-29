-- CreateTable
CREATE TABLE "vehicles" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "vin" TEXT NOT NULL,
    "plate" TEXT,
    "color" TEXT,
    "mileage" INTEGER,
    "notes" TEXT,
    "year" INTEGER,
    "make" TEXT,
    "model" TEXT,
    "trim" TEXT,
    "bodyClass" TEXT,
    "vehicleType" TEXT,
    "fuelType" TEXT,
    "decodedAt" TIMESTAMP(3),
    "decodeSource" TEXT,
    "decodePayload" JSONB,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "vehicles_group_id_idx" ON "vehicles"("groupId");

-- CreateIndex
CREATE INDEX "vehicles_company_id_idx" ON "vehicles"("companyId");

-- CreateIndex
CREATE INDEX "vehicles_service_client_id_idx" ON "vehicles"("serviceClientId");

-- CreateIndex
CREATE INDEX "vehicles_location_id_idx" ON "vehicles"("locationId");

-- CreateIndex
CREATE INDEX "vehicles_company_id_archived_at_idx" ON "vehicles"("companyId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_company_id_vin_key" ON "vehicles"("companyId", "vin");

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_serviceClientId_fkey" FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
