import "reflect-metadata";

import { randomBytes, randomUUID } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { CompanyRole, MembershipStatus, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("labor work assignments", () => {
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

  it("rejects starting work without clock-in", async () => {
    const fixture = await createFixture();

    await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixture.companyId,
        pin: "123456",
        serviceClientId: fixture.serviceClientId,
        locationId: fixture.locationId,
        serviceCatalogItemId: fixture.serviceCatalogItemId
      })
      .expect(400);
  });

  it("starts work with active clock-in", async () => {
    const fixture = await createFixture();
    await clockIn(fixture);

    const response = await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixture.companyId,
        pin: "123456",
        serviceClientId: fixture.serviceClientId,
        locationId: fixture.locationId,
        serviceCatalogItemId: fixture.serviceCatalogItemId,
        notes: "Start notes"
      })
      .expect(201);

    expect(response.body.assignment.status).toBe("IN_PROGRESS");
    expect(response.body.assignment.clientName).toBe("Labor Client");
  });

  it("rejects cross-company client/location on start", async () => {
    const fixtureA = await createFixture("Alpha");
    const fixtureB = await createFixture("Beta");
    await clockIn(fixtureA);

    await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixtureA.companyId,
        pin: "123456",
        serviceClientId: fixtureB.serviceClientId,
        locationId: fixtureB.locationId,
        serviceCatalogItemId: fixtureA.serviceCatalogItemId
      })
      .expect(403);
  });

  it("completes and blocks assignments with persisted timestamps", async () => {
    const fixture = await createFixture();
    await clockIn(fixture);

    const started = await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixture.companyId,
        pin: "123456",
        serviceClientId: fixture.serviceClientId,
        locationId: fixture.locationId,
        serviceCatalogItemId: fixture.serviceCatalogItemId
      })
      .expect(201);

    const assignmentId = started.body.assignment.id as string;

    const blocked = await request(httpServer)
      .post(`/field/labor-work/${assignmentId}/block`)
      .send({
        companyId: fixture.companyId,
        pin: "123456",
        blockedReason: "Waiting for keys"
      })
      .expect(201);

    expect(blocked.body.assignment.status).toBe("BLOCKED");
    expect(blocked.body.assignment.blockedReason).toBe("Waiting for keys");

    await prisma.laborWorkAssignment.update({
      where: { id: assignmentId },
      data: { status: "IN_PROGRESS", blockedAt: null, blockedReason: null }
    });

    const completed = await request(httpServer)
      .post(`/field/labor-work/${assignmentId}/complete`)
      .send({ companyId: fixture.companyId, pin: "123456" })
      .expect(201);

    expect(completed.body.assignment.status).toBe("COMPLETED");
    expect(completed.body.assignment.completedAt).toBeTruthy();
  });

  it("lists assignments for admin and rejects cross-company access", async () => {
    const fixtureA = await createFixture("Alpha");
    const fixtureB = await createFixture("Beta");
    await clockIn(fixtureA);

    await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixtureA.companyId,
        pin: "123456",
        serviceClientId: fixtureA.serviceClientId,
        locationId: fixtureA.locationId,
        serviceCatalogItemId: fixtureA.serviceCatalogItemId
      })
      .expect(201);

    const list = await request(httpServer)
      .get(`/company-operations/companies/${fixtureA.companyId}/labor-work-assignments`)
      .set("Cookie", fixtureA.adminSession)
      .expect(200);

    expect(list.body.items).toHaveLength(1);

    await request(httpServer)
      .get(`/company-operations/companies/${fixtureB.companyId}/labor-work-assignments`)
      .set("Cookie", fixtureA.adminSession)
      .expect(403);
  });

  it("scopes labor work list and CSV export to supervisor assigned locations", async () => {
    const fixture = await createSupervisorScopedLaborFixture();
    const supervisorSession = await login(fixture.supervisorEmail, fixture.supervisorPassword);
    const adminSession = await login(fixture.adminEmail, fixture.adminPassword);

    await startWorkAtLocation(fixture, {
      pin: "123456",
      locationId: fixture.locationAId,
      serviceClientId: fixture.serviceClientId,
      serviceCatalogItemId: fixture.serviceCatalogItemId,
      kioskId: fixture.kioskAId,
      kioskSecret: fixture.kioskSecretA
    });

    await startWorkAtLocation(fixture, {
      pin: "654321",
      locationId: fixture.locationBId,
      serviceClientId: fixture.serviceClientId,
      serviceCatalogItemId: fixture.serviceCatalogItemId,
      kioskId: fixture.kioskBId,
      kioskSecret: fixture.kioskSecretB
    });

    const adminList = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/labor-work-assignments`)
      .set("Cookie", adminSession)
      .expect(200);
    expect(adminList.body.items).toHaveLength(2);

    const supervisorList = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/labor-work-assignments`)
      .set("Cookie", supervisorSession)
      .expect(200);

    expect(supervisorList.body.items).toHaveLength(1);
    expect(supervisorList.body.items[0].locationId).toBe(fixture.locationAId);
    expect(
      supervisorList.body.items.some((item: { locationId: string }) => item.locationId === fixture.locationBId)
    ).toBe(false);

    const supervisorCsv = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/labor-work-assignments/export-csv`)
      .set("Cookie", supervisorSession)
      .expect(200);

    const csvText = supervisorCsv.text;
    expect(csvText).toContain("Scope Site A");
    expect(csvText).not.toContain("Scope Site B");
    expect(csvText.split("\n").filter(Boolean)).toHaveLength(2);
  });

  it("blocks clock-out while work is in progress", async () => {
    const fixture = await createFixture();
    await clockIn(fixture);

    const started = await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixture.companyId,
        pin: "123456",
        serviceClientId: fixture.serviceClientId,
        locationId: fixture.locationId,
        serviceCatalogItemId: fixture.serviceCatalogItemId
      })
      .expect(201);

    expect(started.body.assignment.id).toBeTruthy();

    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "clock_out", idempotencyKey: randomUUID() })
      .expect(400);
  });

  async function startWorkAtLocation(
    fixture: {
      companyId: string;
      serviceClientId: string;
      serviceCatalogItemId: string;
    },
    input: {
      pin: string;
      locationId: string;
      serviceClientId: string;
      serviceCatalogItemId: string;
      kioskId: string;
      kioskSecret: string;
    }
  ) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(input.kioskId, input.kioskSecret))
      .send({ pin: input.pin, action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);
    vi.useRealTimers();

    await request(httpServer)
      .post("/field/labor-work/start")
      .send({
        companyId: fixture.companyId,
        pin: input.pin,
        serviceClientId: input.serviceClientId,
        locationId: input.locationId,
        serviceCatalogItemId: input.serviceCatalogItemId
      })
      .expect(201);
  }

  async function clockIn(fixture: Awaited<ReturnType<typeof createFixture>>) {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-06T13:00:00.000Z"));
    await request(httpServer)
      .post("/kiosk/punch")
      .set(kioskHeaders(fixture.kiosk.id, fixture.kioskSecret))
      .send({ pin: "123456", action: "clock_in", idempotencyKey: randomUUID() })
      .expect(201);
    vi.useRealTimers();
  }

  async function createSupervisorScopedLaborFixture() {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `scope-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;
    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({ name: "Scope Group", ownerEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: groupResponse.body.invitationToken, password: ownerPassword, fullName: "Scope Owner" })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);
    const adminEmail = `scope-admin-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;
    const supervisorEmail = `scope-supervisor-${randomBytes(3).toString("hex")}@example.com`;
    const supervisorPassword = `Super!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: "Scope Company", adminEmail })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: companyResponse.body.invitationToken, password: adminPassword, fullName: "Scope Admin" })
      .expect(200);

    const companyId = companyResponse.body.company.id as string;
    const adminSession = await login(adminEmail, adminPassword);

    const supervisorUser = await prisma.user.create({
      data: {
        email: supervisorEmail,
        passwordHash: await argon2.hash(supervisorPassword, ARGON2_OPTIONS),
        fullName: "Scope Supervisor"
      }
    });

    await prisma.companyMembership.create({
      data: {
        companyId,
        userId: supervisorUser.id,
        email: supervisorEmail,
        role: CompanyRole.SUPERVISOR,
        status: MembershipStatus.ACTIVE
      }
    });

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: "Scope Client" })
      .expect(201);

    const locationAResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Scope Site A",
        timezone: "America/New_York"
      })
      .expect(201);

    const locationBResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: "Scope Site B",
        timezone: "America/New_York"
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/locations/${locationAResponse.body.id}/supervisors`)
      .set("Cookie", adminSession)
      .send({ supervisorUserId: supervisorUser.id })
      .expect(201);

    const catalogResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", adminSession)
      .send({ name: "Scope Detail", fixedPriceMinor: 15000 })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Scope Employee A", pin: "123456" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Scope Employee B", pin: "654321" })
      .expect(201);

    const groupId = (await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).groupId;
    const kioskSecretA = `kiosk-a-${randomBytes(8).toString("hex")}`;
    const kioskA = await prisma.kiosk.create({
      data: {
        groupId,
        companyId,
        locationId: locationAResponse.body.id,
        name: "Scope Kiosk A"
      }
    });
    await prisma.kioskCredential.create({
      data: {
        kioskId: kioskA.id,
        secretHash: await argon2.hash(kioskSecretA, ARGON2_OPTIONS)
      }
    });

    const kioskSecretB = `kiosk-b-${randomBytes(8).toString("hex")}`;
    const kioskB = await prisma.kiosk.create({
      data: {
        groupId,
        companyId,
        locationId: locationBResponse.body.id,
        name: "Scope Kiosk B"
      }
    });
    await prisma.kioskCredential.create({
      data: {
        kioskId: kioskB.id,
        secretHash: await argon2.hash(kioskSecretB, ARGON2_OPTIONS)
      }
    });

    for (const employee of await prisma.employee.findMany({ where: { companyId } })) {
      await request(httpServer)
        .post(`/company-operations/companies/${companyId}/shifts`)
        .set("Cookie", adminSession)
        .send({
          employeeId: employee.id,
          serviceClientId: clientResponse.body.id,
          locationId: employee.fullName.includes("A") ? locationAResponse.body.id : locationBResponse.body.id,
          scheduledStartUtc: "2026-04-06T13:00:00.000Z",
          scheduledEndUtc: "2026-04-06T21:00:00.000Z"
        })
        .expect(201);
    }

    return {
      companyId,
      adminEmail,
      adminPassword,
      supervisorEmail,
      supervisorPassword,
      serviceClientId: clientResponse.body.id as string,
      locationAId: locationAResponse.body.id as string,
      locationBId: locationBResponse.body.id as string,
      serviceCatalogItemId: catalogResponse.body.id as string,
      kioskAId: kioskA.id,
      kioskSecretA,
      kioskBId: kioskB.id,
      kioskSecretB
    };
  }

  async function createFixture(label = "Labor") {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `${label.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
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
    const adminEmail = `${label.toLowerCase()}-admin-${randomBytes(3).toString("hex")}@example.com`;
    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: `${label} Company`, adminEmail })
      .expect(201);

    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;
    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: companyResponse.body.invitationToken, password: adminPassword, fullName: `${label} Admin` })
      .expect(200);

    const adminSession = await login(adminEmail, adminPassword);
    const companyId = companyResponse.body.company.id as string;

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: `${label} Client` })
      .expect(201);

    const locationResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        serviceClientId: clientResponse.body.id,
        name: `${label} Site`,
        timezone: "America/New_York"
      })
      .expect(201);

    const catalogResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-catalog`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Detail`,
        fixedPriceMinor: 15000
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: `${label} Employee`, pin: "123456" })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: (await prisma.employee.findFirstOrThrow({ where: { companyId } })).id,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    const kioskSecret = `kiosk-${randomBytes(8).toString("hex")}`;
    const kiosk = await prisma.kiosk.create({
      data: {
        groupId: (await prisma.company.findUniqueOrThrow({ where: { id: companyId } })).groupId,
        companyId,
        locationId: locationResponse.body.id,
        name: `${label} Kiosk`
      }
    });

    await prisma.kioskCredential.create({
      data: {
        kioskId: kiosk.id,
        secretHash: await argon2.hash(kioskSecret, ARGON2_OPTIONS)
      }
    });

    return {
      companyId,
      adminSession,
      kiosk,
      kioskSecret,
      serviceClientId: clientResponse.body.id as string,
      locationId: locationResponse.body.id as string,
      serviceCatalogItemId: catalogResponse.body.id as string
    };
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return (response.headers["set-cookie"] as string[])[0];
  }

  function kioskHeaders(kioskId: string, kioskSecret: string) {
    return {
      "x-kiosk-id": kioskId,
      "x-kiosk-secret": kioskSecret
    };
  }
});
