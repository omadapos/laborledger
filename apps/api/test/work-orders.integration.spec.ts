import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
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

describe("work order foundation", () => {
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

  it("supports company-scoped work orders with snapshotted service line prices", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const { clientId, locationId, vehicleId, catalogItemId } = await seedVehicleAndCatalog(
      httpServer,
      adminASession,
      setupA.companyId
    );

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({ vehicleId, serviceCatalogItemIds: [] })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({ vehicleId: "missing", serviceCatalogItemIds: [catalogItemId] })
      .expect(400);

    const createResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({
        vehicleId,
        serviceCatalogItemIds: [catalogItemId],
        notes: "Customer waiting",
        status: "DRAFT"
      })
      .expect(201);

    const workOrderId = createResponse.body.id as string;
    expect(createResponse.body.workOrderNumber).toMatch(/^WO-\d{8}-\d{4}$/);
    expect(createResponse.body.status).toBe("DRAFT");
    expect(createResponse.body.serviceLines).toHaveLength(1);
    expect(createResponse.body.serviceLines[0].unitPriceMinor).toBe(12500);
    expect(createResponse.body.serviceLines[0].lineTotalMinor).toBe(12500);
    expect(createResponse.body.totalServiceAmountMinor).toBe(12500);

    await request(httpServer)
      .post(`/company-operations/service-catalog/${catalogItemId}`)
      .set("Cookie", adminASession)
      .send({
        name: "Interior Detailing",
        description: "Updated",
        category: "Detailing",
        fixedPriceMinor: 15000
      })
      .expect(201);

    const detailAfterCatalogChange = await request(httpServer)
      .get(`/company-operations/work-orders/${workOrderId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(detailAfterCatalogChange.body.serviceLines[0].unitPriceMinor).toBe(12500);

    const secondCreate = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({ vehicleId, serviceCatalogItemIds: [catalogItemId] })
      .expect(201);
    expect(secondCreate.body.workOrderNumber).not.toBe(createResponse.body.workOrderNumber);

    const list = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/work-orders?q=interior`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(list.body).toHaveLength(2);

    await request(httpServer)
      .post(`/company-operations/work-orders/${workOrderId}`)
      .set("Cookie", adminASession)
      .send({ notes: "Updated note", status: "READY" })
      .expect(201);

    const readyDetail = await request(httpServer)
      .get(`/company-operations/work-orders/${workOrderId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(readyDetail.body.status).toBe("READY");
    expect(readyDetail.body.notes).toBe("Updated note");
    expect(readyDetail.body.statusHistory.length).toBeGreaterThanOrEqual(2);

    await request(httpServer)
      .post(`/company-operations/work-orders/${workOrderId}/cancel`)
      .set("Cookie", adminASession)
      .send({ cancelReason: "Customer cancelled" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/work-orders/${workOrderId}`)
      .set("Cookie", adminASession)
      .send({ notes: "Should fail" })
      .expect(400);

    await request(httpServer)
      .get(`/company-operations/work-orders/${workOrderId}`)
      .set("Cookie", await login(setupB.adminEmail, setupB.adminPassword))
      .expect(403);

    const archivedCatalog = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .send({ name: "Archived Service", fixedPriceMinor: 9900 })
      .expect(201);
    const archivedCatalogId = archivedCatalog.body.id as string;
    await request(httpServer)
      .post(`/company-operations/service-catalog/${archivedCatalogId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({ vehicleId, serviceCatalogItemIds: [archivedCatalogId] })
      .expect(400);

    const betaCatalog = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/service-catalog`)
      .set("Cookie", superadminSession)
      .send({ name: "Beta Service", fixedPriceMinor: 5000 })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .send({ vehicleId, serviceCatalogItemIds: [betaCatalog.body.id] })
      .expect(400);

    const auditActions = await prisma.auditEvent.findMany({
      where: { companyId: setupA.companyId, targetType: "WorkOrder" },
      select: { action: true }
    });
    expect(auditActions.map((row) => row.action)).toEqual(
      expect.arrayContaining(["WORK_ORDER_CREATED", "WORK_ORDER_UPDATED", "WORK_ORDER_CANCELLED"])
    );

    expect(clientId).toBeTruthy();
    expect(locationId).toBeTruthy();
  });

  async function seedVehicleAndCatalog(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string
  ) {
    const clientResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", session)
      .send({ name: "Client A" })
      .expect(201);
    const clientId = clientResponse.body.id as string;

    const locationResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", session)
      .send({
        serviceClientId: clientId,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);
    const locationId = locationResponse.body.id as string;

    const vehicleResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientId,
        locationId,
        plate: "ABC123"
      })
      .expect(201);
    const vehicleId = vehicleResponse.body.id as string;

    const catalogResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({
        name: "Interior Detailing",
        category: "Detailing",
        fixedPriceMinor: 12500
      })
      .expect(201);

    return {
      clientId,
      locationId,
      vehicleId,
      catalogItemId: catalogResponse.body.id as string
    };
  }

  async function createCompanyWithAdmin(
    superadminSession: string,
    groupLabel: string,
    adminPrefix: string
  ) {
    const ownerEmail = `${groupLabel.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({
        name: `${groupLabel} Group`,
        ownerEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: groupResponse.body.invitationToken,
        password: ownerPassword,
        fullName: `${groupLabel} Owner`
      })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminEmail = `${adminPrefix}-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: `${groupLabel} Company`,
        adminEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${groupLabel} Admin`
      })
      .expect(200);

    return {
      companyId: companyResponse.body.company.id as string,
      adminEmail,
      adminPassword
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    return cookies?.[0] ?? "";
  }
});
