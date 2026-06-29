ALTER TYPE "CompanyRole" ADD VALUE IF NOT EXISTS 'SUPERVISOR';

CREATE TABLE "service_clients" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_clients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "locations" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_pin_credentials" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_pin_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "employee_rates" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "rateMinorUnits" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "effectiveStart" TIMESTAMP(3) NOT NULL,
    "effectiveEnd" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "employee_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_labor_rates" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "serviceClientId" TEXT,
    "locationId" TEXT,
    "rateMinorUnits" INTEGER NOT NULL,
    "currencyCode" TEXT NOT NULL DEFAULT 'USD',
    "effectiveStart" TIMESTAMP(3) NOT NULL,
    "effectiveEnd" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_labor_rates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "supervisor_location_assignments" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "supervisorUserId" TEXT NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),

    CONSTRAINT "supervisor_location_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "service_clients_group_id_idx" ON "service_clients"("groupId");
CREATE INDEX "service_clients_company_id_idx" ON "service_clients"("companyId");
CREATE INDEX "service_clients_archived_at_idx" ON "service_clients"("archivedAt");
CREATE UNIQUE INDEX "service_clients_company_id_name_key" ON "service_clients"("companyId", "name");

CREATE INDEX "locations_group_id_idx" ON "locations"("groupId");
CREATE INDEX "locations_company_id_idx" ON "locations"("companyId");
CREATE INDEX "locations_service_client_id_idx" ON "locations"("serviceClientId");
CREATE INDEX "locations_archived_at_idx" ON "locations"("archivedAt");
CREATE UNIQUE INDEX "locations_company_id_name_key" ON "locations"("companyId", "name");

CREATE INDEX "employees_group_id_idx" ON "employees"("groupId");
CREATE INDEX "employees_company_id_idx" ON "employees"("companyId");
CREATE INDEX "employees_archived_at_idx" ON "employees"("archivedAt");
CREATE UNIQUE INDEX "employees_company_id_full_name_key" ON "employees"("companyId", "fullName");

CREATE INDEX "employee_pin_credentials_employee_id_idx" ON "employee_pin_credentials"("employeeId");
CREATE INDEX "employee_pin_credentials_company_id_idx" ON "employee_pin_credentials"("companyId");
CREATE INDEX "employee_pin_credentials_revoked_at_idx" ON "employee_pin_credentials"("revokedAt");

CREATE INDEX "employee_rates_employee_id_idx" ON "employee_rates"("employeeId");
CREATE INDEX "employee_rates_company_id_idx" ON "employee_rates"("companyId");
CREATE INDEX "employee_rates_effective_start_idx" ON "employee_rates"("effectiveStart");

CREATE INDEX "client_labor_rates_company_id_idx" ON "client_labor_rates"("companyId");
CREATE INDEX "client_labor_rates_service_client_id_idx" ON "client_labor_rates"("serviceClientId");
CREATE INDEX "client_labor_rates_location_id_idx" ON "client_labor_rates"("locationId");
CREATE INDEX "client_labor_rates_effective_start_idx" ON "client_labor_rates"("effectiveStart");

CREATE INDEX "supervisor_location_assignments_group_id_idx" ON "supervisor_location_assignments"("groupId");
CREATE INDEX "supervisor_location_assignments_company_id_idx" ON "supervisor_location_assignments"("companyId");
CREATE INDEX "supervisor_location_assignments_location_id_idx" ON "supervisor_location_assignments"("locationId");
CREATE INDEX "supervisor_location_assignments_supervisor_user_id_idx" ON "supervisor_location_assignments"("supervisorUserId");
CREATE INDEX "supervisor_location_assignments_unassigned_at_idx" ON "supervisor_location_assignments"("unassignedAt");

ALTER TABLE "service_clients"
    ADD CONSTRAINT "service_clients_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "service_clients"
    ADD CONSTRAINT "service_clients_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "locations"
    ADD CONSTRAINT "locations_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "locations"
    ADD CONSTRAINT "locations_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "locations"
    ADD CONSTRAINT "locations_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employees"
    ADD CONSTRAINT "employees_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pin_credentials"
    ADD CONSTRAINT "employee_pin_credentials_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pin_credentials"
    ADD CONSTRAINT "employee_pin_credentials_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_pin_credentials"
    ADD CONSTRAINT "employee_pin_credentials_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_rates"
    ADD CONSTRAINT "employee_rates_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_rates"
    ADD CONSTRAINT "employee_rates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "employee_rates"
    ADD CONSTRAINT "employee_rates_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_labor_rates"
    ADD CONSTRAINT "client_labor_rates_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_labor_rates"
    ADD CONSTRAINT "client_labor_rates_serviceClientId_fkey"
    FOREIGN KEY ("serviceClientId") REFERENCES "service_clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_labor_rates"
    ADD CONSTRAINT "client_labor_rates_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "client_labor_rates"
    ADD CONSTRAINT "client_labor_rates_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supervisor_location_assignments"
    ADD CONSTRAINT "supervisor_location_assignments_groupId_fkey"
    FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supervisor_location_assignments"
    ADD CONSTRAINT "supervisor_location_assignments_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supervisor_location_assignments"
    ADD CONSTRAINT "supervisor_location_assignments_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supervisor_location_assignments"
    ADD CONSTRAINT "supervisor_location_assignments_supervisorUserId_fkey"
    FOREIGN KEY ("supervisorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "supervisor_location_assignments"
    ADD CONSTRAINT "supervisor_location_assignments_assignedByUserId_fkey"
    FOREIGN KEY ("assignedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
