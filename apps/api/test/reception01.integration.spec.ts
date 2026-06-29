import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  CompanyRole,
  GroupStatus,
  MembershipStatus,
  PrismaClient
} from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.VIN_DECODER = "stub";
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const KNOWN_VIN = "1HGBH41JXMN109186";

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("RECEPTION01 reception and company jobs flow", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("supports reception flow: vehicle intake, work order creation, jobs list, and job detail", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const seed = await seedCompanyOperations(adminSession, setup.companyId);

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: seed.clientId,
        locationId: seed.locationId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: "INVALID",
        serviceClientId: seed.clientId,
        locationId: seed.locationId
      })
      .expect(400);

    const vehicle = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: seed.clientId,
        locationId: seed.locationId,
        plate: "ABC123"
      })
      .expect(201);

    const workOrder = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({
        vehicleId: vehicle.body.id,
        serviceCatalogItemIds: [seed.catalogItemId],
        status: "READY",
        notes: "Customer waiting in lobby"
      })
      .expect(201);

    expect(workOrder.body.serviceLineCount).toBe(1);
    expect(workOrder.body.vehicle.vin).toBe(KNOWN_VIN);

    const listed = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].id).toBe(workOrder.body.id);

    const vinSearch = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/work-orders?q=${KNOWN_VIN}`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(vinSearch.body).toHaveLength(1);

    const statusFilter = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/work-orders?status=READY`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(statusFilter.body).toHaveLength(1);

    const detail = await request(httpServer)
      .get(`/company-operations/work-orders/${workOrder.body.id}`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(detail.body.workOrderNumber).toBe(workOrder.body.workOrderNumber);
    expect(detail.body.notes).toBe("Customer waiting in lobby");
  });

  it("rejects cross-company job list/detail access", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);
    const adminBSession = await login(setupB.adminEmail, setupB.adminPassword);
    const seed = await seedCompanyOperations(adminASession, setupA.companyId);

    const vehicle = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/vehicles`)
      .set("Cookie", adminASession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: seed.clientId,
        locationId: seed.locationId
      })
      .expect(201);

    const workOrder = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({
        vehicleId: vehicle.body.id,
        serviceCatalogItemIds: [seed.catalogItemId],
        status: "READY"
      })
      .expect(201);

    const companyBList = await request(httpServer)
      .get(`/company-operations/companies/${setupB.companyId}/work-orders`)
      .set("Cookie", adminBSession)
      .expect(200);

    expect(companyBList.body).toHaveLength(0);

    await request(httpServer)
      .get(`/company-operations/work-orders/${workOrder.body.id}`)
      .set("Cookie", adminBSession)
      .expect(403);
  });

  it("blocks supervisor from creating work orders and scopes supervisor job visibility", async () => {
    const fixture = await createSupervisorFixture();

    await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/vehicles`)
      .set("Cookie", fixture.supervisorSession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: fixture.clientId,
        locationId: fixture.locationAId
      })
      .expect(403);

    const supervisorJobs = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/work-orders`)
      .set("Cookie", fixture.supervisorSession)
      .expect(200);

    expect(supervisorJobs.body).toHaveLength(1);
    expect(supervisorJobs.body[0].location.id).toBe(fixture.locationAId);
  });

  it("blocks reception/jobs access for suspended groups", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const company = await prisma.company.findUniqueOrThrow({ where: { id: setup.companyId } });

    await prisma.group.update({
      where: { id: company.groupId },
      data: { status: GroupStatus.SUSPENDED, suspendedAt: new Date(), suspendedReason: "Test suspend" }
    });

    await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .expect(403);
  });

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const raw = (response.headers["set-cookie"] as string[] | undefined)?.find((value) =>
      value.startsWith("laborledger.sid=")
    );
    return raw?.split(";")[0] ?? "";
  }

  async function createCompanyWithAdmin(
    superadminSession: string,
    label: string,
    slug: string
  ) {
    const adminEmail = `${slug}-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = "AdminTemp!123";

    const created = await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", superadminSession)
      .send({
        customerName: label,
        companyName: `${label} Main Shop`,
        ownerFullName: `${label} Owner`,
        ownerEmail: adminEmail,
        ownerPassword: adminPassword
      })
      .expect(201);

    return {
      companyId: created.body.company.id as string,
      adminEmail,
      adminPassword
    };
  }

  async function seedCompanyOperations(session: string, companyId: string) {
    const client = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", session)
      .send({ name: "Client A" })
      .expect(201);

    const location = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", session)
      .send({
        serviceClientId: client.body.id,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    const catalog = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Oil Change", fixedPriceMinor: 9900 })
      .expect(201);

    return {
      clientId: client.body.id as string,
      locationId: location.body.id as string,
      catalogItemId: catalog.body.id as string
    };
  }

  async function createSupervisorFixture() {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
    const setup = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);
    const seed = await seedCompanyOperations(adminSession, setup.companyId);

    const locationB = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: seed.clientId,
        name: "Location B",
        timezone: "America/New_York"
      })
      .expect(201);

    const vehicleA = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: seed.clientId,
        locationId: seed.locationId
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({
        vehicleId: vehicleA.body.id,
        serviceCatalogItemIds: [seed.catalogItemId],
        status: "READY"
      })
      .expect(201);

    const vehicleB = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: "5YJSA1E11HF000337",
        serviceClientId: seed.clientId,
        locationId: locationB.body.id
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({
        vehicleId: vehicleB.body.id,
        serviceCatalogItemIds: [seed.catalogItemId],
        status: "READY"
      })
      .expect(201);

    const supervisorEmail = `supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = "Supervisor!123";
    const supervisorUser = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: "Alpha Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: setup.companyId,
        userId: supervisorUser.id,
        email: supervisorEmail,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    await request(httpServer)
      .post(`/company-operations/locations/${seed.locationId}/supervisors`)
      .set("Cookie", adminSession)
      .send({ supervisorUserId: supervisorUser.id })
      .expect(201);

    const supervisorSession = await login(supervisorEmail, supervisorPassword);

    return {
      companyId: setup.companyId,
      clientId: seed.clientId,
      locationAId: seed.locationId as string,
      supervisorSession
    };
  }
});
