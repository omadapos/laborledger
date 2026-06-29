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
const OTHER_VIN = "5YJSA1E14HF000001";

describe("worker responsibility scan foundation", () => {
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

  it("supports worker lookup and manual VIN responsibility confirmation", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedAssignedWorkOrders(httpServer, adminASession, setupA.companyId);

    const mariaLookup = await request(httpServer)
      .post("/worker/lookup")
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(201);

    expect(mariaLookup.body.employee.fullName).toBe("Maria Gomez");
    expect(mariaLookup.body.assignments).toHaveLength(1);
    expect(JSON.stringify(mariaLookup.body).toLowerCase()).not.toContain("pinhash");

    const carlosLookup = await request(httpServer)
      .post("/worker/lookup")
      .send({ companyId: setupA.companyId, pin: "654321" })
      .expect(201);

    expect(carlosLookup.body.assignments).toHaveLength(1);
    expect(carlosLookup.body.assignments[0].workOrderId).not.toBe(
      mariaLookup.body.assignments[0].workOrderId
    );

    const scanResponse = await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: seed.mariaWorkOrderId,
        workOrderAssignmentId: seed.mariaAssignmentId,
        enteredVin: KNOWN_VIN,
        idempotencyKey: "scan-maria-1"
      })
      .expect(201);

    expect(scanResponse.body.accepted).toBe(true);
    expect(scanResponse.body.vehicleVin).toBe(KNOWN_VIN);

    const duplicateScan = await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: seed.mariaWorkOrderId,
        workOrderAssignmentId: seed.mariaAssignmentId,
        enteredVin: KNOWN_VIN,
        idempotencyKey: "scan-maria-1"
      })
      .expect(201);

    expect(duplicateScan.body.duplicate).toBe(true);

    await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: seed.mariaWorkOrderId,
        workOrderAssignmentId: seed.mariaAssignmentId,
        enteredVin: OTHER_VIN
      })
      .expect(400);

    const rejectedEvents = await prisma.workerScanEvent.count({
      where: { workOrderId: seed.mariaWorkOrderId, matchedVin: false }
    });
    expect(rejectedEvents).toBeGreaterThanOrEqual(1);

    await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: seed.unassignedWorkOrderId
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.mariaWorkOrderId}/cancel`)
      .set("Cookie", adminASession)
      .send({ cancelReason: "Customer cancelled" })
      .expect(201);

    await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupA.companyId,
        pin: "123456",
        workOrderId: seed.mariaWorkOrderId,
        enteredVin: KNOWN_VIN
      })
      .expect(400);

    await request(httpServer)
      .post("/worker/scan")
      .send({
        companyId: setupB.companyId,
        pin: "123456",
        workOrderId: seed.mariaWorkOrderId,
        enteredVin: KNOWN_VIN
      })
      .expect(401);

    await request(httpServer)
      .post(`/company-operations/employees/${seed.mariaEmployeeId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    await request(httpServer)
      .post("/worker/lookup")
      .send({ companyId: setupA.companyId, pin: "123456" })
      .expect(401);

    const adminDetail = await request(httpServer)
      .get(`/company-operations/work-orders/${seed.mariaWorkOrderId}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(adminDetail.body.workerScanEvents.length).toBeGreaterThanOrEqual(1);
    expect(adminDetail.body.lastResponsibilityConfirmation?.enteredVin).toBe(KNOWN_VIN);

    const responsibilityActions = await prisma.vehicleResponsibilityLog.findMany({
      where: { workOrderId: seed.mariaWorkOrderId },
      select: { action: true }
    });
    expect(responsibilityActions.map((row) => row.action)).toEqual(
      expect.arrayContaining(["RESPONSIBILITY_CONFIRMED", "SCANNED"])
    );
  });

  async function seedAssignedWorkOrders(
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

    const vehicleMaria = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id
      })
      .expect(201);

    const vehicleCarlos = await request(server)
      .post(`/company-operations/companies/${companyId}/vehicles`)
      .set("Cookie", session)
      .send({
        vin: OTHER_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id
      })
      .expect(201);

    const catalogResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Oil Change", fixedPriceMinor: 9900 })
      .expect(201);

    const maria = await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const carlos = await request(server)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", session)
      .send({ fullName: "Carlos Rivera", pin: "654321" })
      .expect(201);

    const mariaWorkOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleMaria.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    const carlosWorkOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleCarlos.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    const unassignedWorkOrder = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleMaria.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    const mariaAssigned = await request(server)
      .post(`/company-operations/work-orders/${mariaWorkOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId: maria.body.id })
      .expect(201);

    await request(server)
      .post(`/company-operations/work-orders/${carlosWorkOrder.body.id}/assignments`)
      .set("Cookie", session)
      .send({ employeeId: carlos.body.id })
      .expect(201);

    return {
      mariaEmployeeId: maria.body.id as string,
      mariaWorkOrderId: mariaWorkOrder.body.id as string,
      mariaAssignmentId: mariaAssigned.body.activeAssignmentId as string,
      unassignedWorkOrderId: unassignedWorkOrder.body.id as string
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
