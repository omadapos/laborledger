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

describe("service completion foundation", () => {
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

  it("records service completion, enforces assignment and scan rules, and transitions work order status", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedCompletionScenario(httpServer, adminASession, setupA.companyId);

    await request(httpServer)
      .post(`/worker/service-lines/${seed.firstServiceLineId}/complete`)
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(400);

    await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: seed.workOrderId,
        workOrderAssignmentId: seed.assignmentId,
        enteredVin: KNOWN_VIN
      })
      .expect(201);

    const firstCompletion = await request(httpServer)
      .post(`/worker/service-lines/${seed.firstServiceLineId}/complete`)
      .send({ companyId: setupA.companyId, pin: "123456", notes: "Done" })
      .expect(201);

    expect(firstCompletion.body.employeeName).toBe("Maria Gomez");
    expect(firstCompletion.body.workOrderStatus).toBe("IN_PROGRESS");
    expect(firstCompletion.body.completedLineCount).toBe(1);
    expect(firstCompletion.body.message).toContain("does not replace time clock punches");
    expect(JSON.stringify(firstCompletion.body).toLowerCase()).not.toContain("pinhash");

    const storedCompletion = await prisma.serviceCompletion.findFirst({
      where: { workOrderServiceLineId: seed.firstServiceLineId, voidedAt: null },
      include: { employee: true }
    });
    expect(storedCompletion?.employee.fullName).toBe("Maria Gomez");
    expect(storedCompletion?.completedAt).toBeTruthy();

    await request(httpServer)
      .post(`/worker/service-lines/${seed.firstServiceLineId}/complete`)
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(400);

    await request(httpServer)
      .post(`/worker/service-lines/${seed.secondServiceLineId}/complete`)
      .send({ companyId: setupA.companyId, pin: "654321" })
      .expect(403);

    const secondCompletion = await request(httpServer)
      .post(`/worker/service-lines/${seed.secondServiceLineId}/complete`)
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(201);

    expect(secondCompletion.body.workOrderStatus).toBe("COMPLETED");
    expect(secondCompletion.body.completedLineCount).toBe(2);

    const adminDetail = await request(httpServer)
      .get(`/company-operations/work-orders/${seed.workOrderId}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(adminDetail.body.status).toBe("COMPLETED");
    expect(adminDetail.body.completedServiceLineCount).toBe(2);
    expect(adminDetail.body.serviceLines[0].activeCompletion.employee.fullName).toBe("Maria Gomez");

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/cancel`)
      .set("Cookie", adminASession)
      .send({ cancelReason: "Customer cancelled" })
      .expect(201);

    const cancelledWorkOrder = await seedSingleLineWorkOrder(
      httpServer,
      adminASession,
      setupA.companyId,
      seed.vehicleId,
      seed.clientId,
      seed.locationId,
      seed.mariaEmployeeId,
      seed.catalogItemId
    );

    await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: cancelledWorkOrder.workOrderId,
        workOrderAssignmentId: cancelledWorkOrder.assignmentId,
        enteredVin: KNOWN_VIN
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/work-orders/${cancelledWorkOrder.workOrderId}/cancel`)
      .set("Cookie", adminASession)
      .send({ cancelReason: "Too late" })
      .expect(201);

    await request(httpServer)
      .post(`/worker/service-lines/${cancelledWorkOrder.serviceLineId}/complete`)
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(400);

    await request(httpServer)
      .post(`/worker/service-lines/${seed.firstServiceLineId}/complete`)
      .send({ companyId: setupB.companyId, pin: "123456" })
      .expect(401);

    const paymentTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name IN ('payments', 'payroll_runs', 'tax_records')`
    );
    expect(paymentTables).toHaveLength(0);
  });

  async function seedCompletionScenario(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string
  ) {
    const clientResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", session)
      .send({ name: "Client A" })
      .expect(201);

    const locationResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", session)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    const vehicleResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id
      })
      .expect(201);

    const oilChange = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Oil Change", fixedPriceMinor: 9900 })
      .expect(201);

    const tireRotation = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Tire Rotation", fixedPriceMinor: 4500 })
      .expect(201);

    const maria = await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Carlos Rivera", pin: "654321" })
      .expect(201);

    const workOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [oilChange.body.id, tireRotation.body.id]
      })
      .expect(201);

    const assigned = await request(server)
      .post(`/company-operations/work-orders/${workOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId: maria.body.id })
      .expect(201);

    const serviceLines = workOrder.body.serviceLines as Array<{ id: string; serviceNameSnapshot: string }>;

    return {
      workOrderId: workOrder.body.id as string,
      assignmentId: assigned.body.activeAssignmentId as string,
      firstServiceLineId: serviceLines[0].id,
      secondServiceLineId: serviceLines[1].id,
      mariaEmployeeId: maria.body.id as string,
      vehicleId: vehicleResponse.body.id as string,
      clientId: clientResponse.body.id as string,
      locationId: locationResponse.body.id as string,
      catalogItemId: oilChange.body.id as string
    };
  }

  async function seedSingleLineWorkOrder(
    server: ReturnType<INestApplication["getHttpServer"]>,
    session: string,
    companyId: string,
    vehicleId: string,
    serviceClientId: string,
    locationId: string,
    employeeId: string,
    catalogItemId: string
  ) {
    const workOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId,
        serviceCatalogItemIds: [catalogItemId]
      })
      .expect(201);

    const assigned = await request(server)
      .post(`/company-operations/work-orders/${workOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId })
      .expect(201);

    const serviceLineId = (workOrder.body.serviceLines as Array<{ id: string }>)[0].id;

    return {
      workOrderId: workOrder.body.id as string,
      assignmentId: assigned.body.activeAssignmentId as string,
      serviceLineId
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
