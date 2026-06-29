import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ARGON2_OPTIONS, resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

describe("SUP02 supervisor location assignment management", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();
  });

  beforeEach(async () => {
    vi.useRealTimers();
    await resetIntegrationDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it("lets company admins list supervisors and manage location assignments", async () => {
    const fixture = await createSup02Fixture();

    const supervisors = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/supervisors`)
      .set("Cookie", fixture.adminASession)
      .expect(200);

    expect(supervisors.body).toHaveLength(1);
    expect(supervisors.body[0].userId).toBe(fixture.supervisorAUserId);
    expect(supervisors.body[0].assignedLocationCount).toBe(0);

    const emptyAssignments = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/supervisor-location-assignments`)
      .set("Cookie", fixture.adminASession)
      .expect(200);
    expect(emptyAssignments.body).toHaveLength(0);

    const assignResponse = await request(httpServer)
      .post(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations`
      )
      .set("Cookie", fixture.adminASession)
      .send({ locationId: fixture.locationAId })
      .expect(201);

    expect(assignResponse.body.locationId).toBe(fixture.locationAId);
    expect(assignResponse.body.supervisorUserId).toBe(fixture.supervisorAUserId);

    await request(httpServer)
      .post(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations`
      )
      .set("Cookie", fixture.adminASession)
      .send({ locationId: fixture.locationAId })
      .expect(400);

    const assignments = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/supervisor-location-assignments`)
      .set("Cookie", fixture.adminASession)
      .expect(200);
    expect(assignments.body).toHaveLength(1);
    expect(assignments.body[0].location.id).toBe(fixture.locationAId);

    const supervisorsAfterAssign = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/supervisors`)
      .set("Cookie", fixture.adminASession)
      .expect(200);
    expect(supervisorsAfterAssign.body[0].assignedLocationCount).toBe(1);

    await request(httpServer)
      .delete(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations/${fixture.locationAId}`
      )
      .set("Cookie", fixture.adminASession)
      .expect(200);

    await request(httpServer)
      .delete(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations/${fixture.locationAId}`
      )
      .set("Cookie", fixture.adminASession)
      .expect(404);

    const auditActions = await prisma.auditEvent.findMany({
      where: {
        companyId: fixture.companyAId,
        action: { in: ["SUPERVISOR_LOCATION_ASSIGNED", "SUPERVISOR_LOCATION_UNASSIGNED"] }
      },
      orderBy: { createdAt: "asc" }
    });
    expect(auditActions.some((event) => event.action === "SUPERVISOR_LOCATION_ASSIGNED")).toBe(true);
    expect(auditActions.some((event) => event.action === "SUPERVISOR_LOCATION_UNASSIGNED")).toBe(true);
  });

  it("blocks supervisors from managing assignments and rejects cross-company targets", async () => {
    const fixture = await createSup02Fixture();

    await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/supervisors`)
      .set("Cookie", fixture.supervisorASession)
      .expect(403);

    await request(httpServer)
      .post(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations`
      )
      .set("Cookie", fixture.supervisorASession)
      .send({ locationId: fixture.locationAId })
      .expect(403);

    await request(httpServer)
      .post(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorBUserId}/locations`
      )
      .set("Cookie", fixture.adminASession)
      .send({ locationId: fixture.locationAId })
      .expect(400);

    await request(httpServer)
      .post(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations`
      )
      .set("Cookie", fixture.adminASession)
      .send({ locationId: fixture.companyBLocationId })
      .expect(404);
  });

  it("reflects supervisor location assignments in existing scoped access", async () => {
    const fixture = await createSup02Fixture();

    const beforeAssign = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/locations`)
      .set("Cookie", fixture.supervisorASession)
      .expect(200);
    expect(beforeAssign.body).toHaveLength(0);

    await request(httpServer)
      .post(
        `/company-operations/companies/${fixture.companyAId}/supervisors/${fixture.supervisorAUserId}/locations`
      )
      .set("Cookie", fixture.adminASession)
      .send({ locationId: fixture.locationAId })
      .expect(201);

    const afterAssign = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyAId}/locations`)
      .set("Cookie", fixture.supervisorASession)
      .expect(200);
    expect(afterAssign.body).toHaveLength(1);
    expect(afterAssign.body[0].id).toBe(fixture.locationAId);

    await request(httpServer)
      .get(`/company-operations/locations/${fixture.locationBId}`)
      .set("Cookie", fixture.supervisorASession)
      .expect(403);
  });

  async function createSup02Fixture() {
    const companyA = await createCompanyFixture("Alpha");
    const companyB = await createCompanyFixture("Beta");

    const supervisorAEmail = `alpha-supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorAPassword = `Super!${randomBytes(4).toString("hex")}`;
    const supervisorAUser = await prisma.user.create({
      data: {
        email: supervisorAEmail,
        passwordHash: await argon2.hash(supervisorAPassword, ARGON2_OPTIONS),
        fullName: "Alpha Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: companyA.companyId,
        userId: supervisorAUser.id,
        email: supervisorAEmail,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    const supervisorBEmail = `beta-supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorBUser = await prisma.user.create({
      data: {
        email: supervisorBEmail,
        passwordHash: await argon2.hash(`Super!${randomBytes(4).toString("hex")}`, ARGON2_OPTIONS),
        fullName: "Beta Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId: companyB.companyId,
        userId: supervisorBUser.id,
        email: supervisorBEmail,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    const clientA = await request(httpServer)
      .post(`/company-operations/companies/${companyA.companyId}/service-clients`)
      .set("Cookie", companyA.adminSession)
      .send({ name: "Alpha Client" })
      .expect(201);

    const locationA = await request(httpServer)
      .post(`/company-operations/companies/${companyA.companyId}/locations`)
      .set("Cookie", companyA.adminSession)
      .send({
        name: "Alpha Site A",
        timezone: "America/New_York",
        serviceClientId: clientA.body.id
      })
      .expect(201);

    const locationB = await request(httpServer)
      .post(`/company-operations/companies/${companyA.companyId}/locations`)
      .set("Cookie", companyA.adminSession)
      .send({
        name: "Alpha Site B",
        timezone: "America/New_York",
        serviceClientId: clientA.body.id
      })
      .expect(201);

    const clientB = await request(httpServer)
      .post(`/company-operations/companies/${companyB.companyId}/service-clients`)
      .set("Cookie", companyB.adminSession)
      .send({ name: "Beta Client" })
      .expect(201);

    const companyBLocation = await request(httpServer)
      .post(`/company-operations/companies/${companyB.companyId}/locations`)
      .set("Cookie", companyB.adminSession)
      .send({
        name: "Beta Site",
        timezone: "America/New_York",
        serviceClientId: clientB.body.id
      })
      .expect(201);

    const supervisorASession = await login(supervisorAEmail, supervisorAPassword);

    return {
      companyAId: companyA.companyId,
      companyBId: companyB.companyId,
      adminASession: companyA.adminSession,
      supervisorASession,
      supervisorAUserId: supervisorAUser.id,
      supervisorBUserId: supervisorBUser.id,
      locationAId: locationA.body.id as string,
      locationBId: locationB.body.id as string,
      companyBLocationId: companyBLocation.body.id as string
    };
  }

  async function createCompanyFixture(label: string) {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `${label.toLowerCase()}-owner-${randomBytes(2).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({ name: `${label} Group`, ownerEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: groupResponse.body.invitationToken, password: ownerPassword, fullName: `${label} Owner` })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);
    const groupId = groupResponse.body.group.id as string;
    const adminEmail = `${label.toLowerCase()}-admin-${randomBytes(2).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupId}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: `${label} Company`, adminEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${label} Admin`
      })
      .expect(200);

    const adminSession = await login(adminEmail, adminPassword);

    return {
      companyId: companyResponse.body.company.id as string,
      adminSession
    };
  }

  function extractSessionCookie(setCookie: string[] | undefined) {
    const raw = setCookie?.find((value) => value.startsWith("laborledger.sid="));
    return raw?.split(";")[0] ?? "";
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return extractSessionCookie(response.headers["set-cookie"] as string[]);
  }
});
