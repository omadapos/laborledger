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
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("company operational setup", () => {
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

  it("enforces company operations setup rules and auditability", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");

    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-clients`)
      .set("Cookie", adminASession)
      .send({ name: "   " })
      .expect(400);

    const clientAResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-clients`)
      .set("Cookie", adminASession)
      .send({ name: "Client A" })
      .expect(201);

    const clientAId = clientAResponse.body.id as string;

    const defaultClientRate = await prisma.clientLaborRate.findFirstOrThrow({
      where: {
        companyId: setupA.companyId,
        serviceClientId: clientAId,
        locationId: null
      }
    });
    expect(defaultClientRate.rateMinorUnits).toBe(2300);
    expect(defaultClientRate.currencyCode).toBe("USD");

    await request(httpServer)
      .post(`/company-operations/service-clients/${clientAId}`)
      .set("Cookie", adminASession)
      .send({ name: "Client A Updated" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/service-clients/${clientAId}/rates`)
      .set("Cookie", adminASession)
      .send({
        rateMinorUnits: 2500,
        effectiveStart: "2026-01-01T00:00:00.000Z",
        effectiveEnd: "2026-02-01T00:00:00.000Z"
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/service-clients/${clientAId}/rates`)
      .set("Cookie", adminASession)
      .send({
        rateMinorUnits: 2600,
        effectiveStart: "2026-01-15T00:00:00.000Z"
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/locations`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        name: "Location Bad TZ",
        timezone: "Invalid/Timezone"
      })
      .expect(400);

    const locationAResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/locations`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        name: "Location A",
        timezone: "America/New_York"
      })
      .expect(201);

    const locationAId = locationAResponse.body.id as string;

    const betaClientResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/service-clients`)
      .set("Cookie", superadminSession)
      .send({ name: "Client B" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/locations/${locationAId}`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: betaClientResponse.body.id,
        name: "Cross Client",
        timezone: "America/New_York"
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/locations/${locationAId}`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        name: "Location A Updated",
        timezone: "America/Chicago"
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/locations/${locationAId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/locations/${locationAId}/unarchive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    const reactivatedLocation = await request(httpServer)
      .get(`/company-operations/locations/${locationAId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(reactivatedLocation.body.archivedAt).toBeNull();
    expect(reactivatedLocation.body.name).toBe("Location A Updated");
    expect(reactivatedLocation.body.timezone).toBe("America/Chicago");

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/locations`)
      .set("Cookie", adminASession)
      .send({
        serviceClientId: clientAId,
        name: "   ",
        timezone: "America/New_York"
      })
      .expect(400);

    const employeeCreateResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/employees`)
      .set("Cookie", adminASession)
      .send({
        fullName: "Employee One",
        pin: "123456"
      })
      .expect(201);

    expect(employeeCreateResponse.body.pin).toBeUndefined();
    expect(employeeCreateResponse.body.pinHash).toBeUndefined();

    const employeeId = employeeCreateResponse.body.id as string;

    const activePin = await prisma.employeePinCredential.findFirstOrThrow({
      where: {
        employeeId,
        revokedAt: null
      }
    });
    expect(await argon2.verify(activePin.pinHash, "123456")).toBe(true);

    const defaultEmployeeRate = await prisma.employeeRate.findFirstOrThrow({
      where: {
        employeeId
      }
    });
    expect(defaultEmployeeRate.rateMinorUnits).toBe(1900);
    expect(defaultEmployeeRate.currencyCode).toBe("USD");

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/employees`)
      .set("Cookie", adminASession)
      .send({
        fullName: "Invalid Pin Employee",
        pin: "12345"
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/employees`)
      .set("Cookie", adminASession)
      .send({
        fullName: "Employee Duplicate Pin",
        pin: "123456"
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/employees`)
      .set("Cookie", superadminSession)
      .send({
        fullName: "Employee Other Company",
        pin: "123456"
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}/rates`)
      .set("Cookie", adminASession)
      .send({
        rateMinorUnits: 2100,
        effectiveStart: "2026-03-01T00:00:00.000Z",
        effectiveEnd: "2026-04-01T00:00:00.000Z"
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}/rates`)
      .set("Cookie", adminASession)
      .send({
        rateMinorUnits: 2200,
        effectiveStart: "2026-03-15T00:00:00.000Z"
      })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}/pin/regenerate`)
      .set("Cookie", adminASession)
      .send({ pin: "654321" })
      .expect(201);

    const newActivePin = await prisma.employeePinCredential.findFirstOrThrow({
      where: {
        employeeId,
        revokedAt: null
      },
      orderBy: { createdAt: "desc" }
    });
    expect(await argon2.verify(newActivePin.pinHash, "654321")).toBe(true);

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}`)
      .set("Cookie", adminASession)
      .send({ fullName: "Employee One Updated" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}/unarchive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    const reactivatedEmployee = await request(httpServer)
      .get(`/company-operations/employees/${employeeId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(reactivatedEmployee.body.archivedAt).toBeNull();
    expect(reactivatedEmployee.body.fullName).toBe("Employee One Updated");

    await request(httpServer)
      .post(`/company-operations/employees/${employeeId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);

    const supervisorPassword = "Supervisor!123";
    const supervisorHash = await argon2.hash(supervisorPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });

    const supervisorUser = await prisma.user.create({
      data: {
        email: `supervisor-${randomBytes(3).toString("hex")}@example.com`,
        passwordHash: supervisorHash,
        fullName: "Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: setupA.companyId,
        userId: supervisorUser.id,
        email: supervisorUser.email,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    const assignmentResponse = await request(httpServer)
      .post(`/company-operations/locations/${locationAId}/supervisors`)
      .set("Cookie", adminASession)
      .send({ supervisorUserId: supervisorUser.id })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/locations/${locationAId}/supervisors`)
      .set("Cookie", adminASession)
      .send({ supervisorUserId: supervisorUser.id })
      .expect(400);

    const supervisorsList = await request(httpServer)
      .get(`/company-operations/locations/${locationAId}/supervisors`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(supervisorsList.body).toHaveLength(1);

    await request(httpServer)
      .delete(`/company-operations/supervisor-assignments/${assignmentResponse.body.id}`)
      .set("Cookie", adminASession)
      .expect(200);

    await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/service-clients`)
      .set("Cookie", adminASession)
      .send({ name: "Cross Tenant Client" })
      .expect(403);

    const archivedClient = await request(httpServer)
      .post(`/company-operations/service-clients/${clientAId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);
    expect(archivedClient.body.archivedAt).toBeTruthy();

    const reactivatedClient = await request(httpServer)
      .post(`/company-operations/service-clients/${clientAId}/unarchive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);
    expect(reactivatedClient.body.archivedAt).toBeNull();

    const actionCounts = await prisma.auditEvent.groupBy({
      by: ["action"],
      where: {
        companyId: setupA.companyId
      },
      _count: {
        action: true
      }
    });

    expect(actionCounts.some((row) => row.action === "SERVICE_CLIENT_CREATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "SERVICE_CLIENT_UPDATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "SERVICE_CLIENT_ARCHIVED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "SERVICE_CLIENT_UNARCHIVED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "LOCATION_CREATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "LOCATION_UPDATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "LOCATION_ARCHIVED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "LOCATION_UNARCHIVED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "EMPLOYEE_CREATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "EMPLOYEE_UPDATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "EMPLOYEE_ARCHIVED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "EMPLOYEE_UNARCHIVED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "EMPLOYEE_RATE_SET")).toBe(true);
    expect(actionCounts.some((row) => row.action === "CLIENT_RATE_SET")).toBe(true);
    expect(actionCounts.some((row) => row.action === "EMPLOYEE_PIN_REGENERATED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "SUPERVISOR_LOCATION_ASSIGNED")).toBe(true);
    expect(actionCounts.some((row) => row.action === "SUPERVISOR_LOCATION_UNASSIGNED")).toBe(true);
  });

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
