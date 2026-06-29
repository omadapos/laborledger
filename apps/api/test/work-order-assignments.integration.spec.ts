import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
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

describe("work order assignment foundation", () => {
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

  it("assigns, reassigns, and unassigns employees with responsibility history", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    const seed = await seedWorkOrderContext(httpServer, adminASession, setupA.companyId);

    const employeeA = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/employees`)
      .set("Cookie", adminASession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const employeeB = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/employees`)
      .set("Cookie", adminASession)
      .send({ fullName: "Carlos Rivera", pin: "654321" })
      .expect(201);

    const otherCompanyEmployee = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/employees`)
      .set("Cookie", superadminSession)
      .send({ fullName: "Other Co Worker", pin: "111111" })
      .expect(201);

    const assignResponse = await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/assignments`)
      .set("Cookie", adminASession)
      .send({ employeeId: employeeA.body.id })
      .expect(201);

    expect(assignResponse.body.status).toBe("ASSIGNED");
    expect(assignResponse.body.assignedEmployee).toEqual({
      id: employeeA.body.id,
      fullName: "Maria Gomez"
    });
    expect(assignResponse.body.activeAssignmentId).toBeTruthy();
    expect(assignResponse.body.responsibilityLogs.length).toBeGreaterThanOrEqual(1);

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/assignments`)
      .set("Cookie", adminASession)
      .send({ employeeId: employeeA.body.id })
      .expect(400);

    const reassignResponse = await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/assignments`)
      .set("Cookie", adminASession)
      .send({ employeeId: employeeB.body.id })
      .expect(201);

    expect(reassignResponse.body.assignedEmployee.fullName).toBe("Carlos Rivera");
    expect(reassignResponse.body.assignments.filter((row: { unassignedAt: string | null }) => !row.unassignedAt)).toHaveLength(1);

    const logActions = reassignResponse.body.responsibilityLogs.map((row: { action: string }) => row.action);
    expect(logActions).toEqual(expect.arrayContaining(["ASSIGNED", "UNASSIGNED", "REASSIGNED"]));

    const assignmentId = reassignResponse.body.activeAssignmentId as string;

    await request(httpServer)
      .post(`/company-operations/work-order-assignments/${assignmentId}/unassign`)
      .set("Cookie", adminASession)
      .send({ unassignReason: "Shift change" })
      .expect(201);

    const afterUnassign = await request(httpServer)
      .get(`/company-operations/work-orders/${seed.workOrderId}`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(afterUnassign.body.assignedEmployee).toBeNull();
    expect(afterUnassign.body.responsibilityLogs[0].action).toBe("UNASSIGNED");

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/assignments`)
      .set("Cookie", adminASession)
      .send({ employeeId: otherCompanyEmployee.body.id })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/assignments`)
      .set("Cookie", adminASession)
      .send({ employeeId: employeeA.body.id, workOrderServiceLineId: "missing-line" })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/cancel`)
      .set("Cookie", adminASession)
      .send({ cancelReason: "Customer cancelled" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/work-orders/${seed.workOrderId}/assignments`)
      .set("Cookie", adminASession)
      .send({ employeeId: employeeA.body.id })
      .expect(400);

    const list = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/work-orders`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(list.body[0].assignedEmployee).toBeNull();

    await request(httpServer)
      .get(`/company-operations/work-orders/${seed.workOrderId}`)
      .set("Cookie", await login(setupB.adminEmail, setupB.adminPassword))
      .expect(403);
  });

  it("rejects archived employees and enforces supervisor location scope", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setup = await createCompanyWithAdmin(superadminSession, "Scope", "scope-admin");
    const adminSession = await login(setup.adminEmail, setup.adminPassword);

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: "Client A" })
      .expect(201);

    const locationA = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    const locationB = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Location B",
        timezone: "America/New_York"
      })
      .expect(201);

    const vehicleA = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: KNOWN_VIN,
        serviceClientId: clientResponse.body.id,
        locationId: locationA.body.id
      })
      .expect(201);

    const vehicleB = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/vehicles`)
      .set("Cookie", adminSession)
      .send({
        vin: "5YJSA1E14HF000001",
        serviceClientId: clientResponse.body.id,
        locationId: locationB.body.id
      })
      .expect(201);

    const catalog = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/service-catalog`)
      .set("Cookie", adminSession)
      .send({ name: "Oil Change", fixedPriceMinor: 9900 })
      .expect(201);

    const workOrderA = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({ vehicleId: vehicleA.body.id, serviceCatalogItemIds: [catalog.body.id] })
      .expect(201);

    const workOrderB = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({ vehicleId: vehicleB.body.id, serviceCatalogItemIds: [catalog.body.id] })
      .expect(201);

    const employee = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Scoped Worker", pin: "123456" })
      .expect(201);

    const supervisorEmail = `supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = `Super!${randomBytes(4).toString("hex")}`;

    const supervisorUser = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: "Scoped Supervisor"
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
      .post(`/company-operations/locations/${locationA.body.id}/supervisors`)
      .set("Cookie", adminSession)
      .send({ supervisorUserId: supervisorUser.id })
      .expect(201);

    const supervisorSession = await login(supervisorEmail, supervisorPassword);

    const scopedList = await request(httpServer)
      .get(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", supervisorSession)
      .expect(200);

    expect(scopedList.body).toHaveLength(1);
    expect(scopedList.body[0].id).toBe(workOrderA.body.id);

    await request(httpServer)
      .post(`/company-operations/work-orders/${workOrderA.body.id}/assignments`)
      .set("Cookie", supervisorSession)
      .send({ employeeId: employee.body.id })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/work-orders/${workOrderB.body.id}/assignments`)
      .set("Cookie", supervisorSession)
      .send({ employeeId: employee.body.id })
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/employees/${employee.body.id}/archive`)
      .set("Cookie", adminSession)
      .send({})
      .expect(201);

    const freshWorkOrder = await request(httpServer)
      .post(`/company-operations/companies/${setup.companyId}/work-orders`)
      .set("Cookie", adminSession)
      .send({ vehicleId: vehicleA.body.id, serviceCatalogItemIds: [catalog.body.id] })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/work-orders/${freshWorkOrder.body.id}/assignments`)
      .set("Cookie", adminSession)
      .send({ employeeId: employee.body.id })
      .expect(400);
  });

  async function seedWorkOrderContext(
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

    const catalogResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", session)
      .send({ name: "Interior Detailing", fixedPriceMinor: 12500 })
      .expect(201);

    const workOrderResponse = await request(server)
      .post(`/company-operations/companies/${companyId}/work-orders`)
      .set("Cookie", session)
      .send({
        vehicleId: vehicleResponse.body.id,
        serviceCatalogItemIds: [catalogResponse.body.id]
      })
      .expect(201);

    return { workOrderId: workOrderResponse.body.id as string };
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
