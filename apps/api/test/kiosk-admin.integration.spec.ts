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
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
describe("kiosk admin management", () => {
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

  it("creates, lists, and details kiosks without exposing stored secrets", async () => {
    const fixture = await createCompanyFixture("Alpha");
    const adminSession = await login(fixture.adminEmail, fixture.adminPassword);

    const createResponse = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/kiosks`)
      .set("Cookie", adminSession)
      .send({
        name: "Front Desk Kiosk",
        locationId: fixture.locationId
      })
      .expect(201);

    expect(createResponse.body.kiosk.id).toBeTruthy();
    expect(createResponse.body.kiosk.name).toBe("Front Desk Kiosk");
    expect(createResponse.body.kiosk.locationId).toBe(fixture.locationId);
    expect(createResponse.body.kiosk.credentialStatus).toBe("active");
    expect(createResponse.body.kioskSecret).toBeTruthy();
    expect(createResponse.body.kiosk.secretHash).toBeUndefined();

    const listResponse = await request(httpServer)
      .get(`/company-operations/companies/${fixture.companyId}/kiosks`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(listResponse.body).toHaveLength(1);
    expect(listResponse.body[0].name).toBe("Front Desk Kiosk");
    expect(listResponse.body[0].secretHash).toBeUndefined();
    expect(listResponse.body[0].kioskSecret).toBeUndefined();

    const detailResponse = await request(httpServer)
      .get(`/company-operations/kiosks/${createResponse.body.kiosk.id}`)
      .set("Cookie", adminSession)
      .expect(200);

    expect(detailResponse.body.id).toBe(createResponse.body.kiosk.id);
    expect(detailResponse.body.secretHash).toBeUndefined();
    expect(detailResponse.body.kioskSecret).toBeUndefined();
  });

  it("rejects kiosk creation for a location outside the company", async () => {
    const fixtureA = await createCompanyFixture("Alpha");
    const fixtureB = await createCompanyFixture("Beta");
    const adminASession = await login(fixtureA.adminEmail, fixtureA.adminPassword);

    await request(httpServer)
      .post(`/company-operations/companies/${fixtureA.companyId}/kiosks`)
      .set("Cookie", adminASession)
      .send({
        name: "Wrong Company Kiosk",
        locationId: fixtureB.locationId
      })
      .expect(400);
  });

  it("scopes kiosk listing to the authorized company", async () => {
    const fixtureA = await createCompanyFixture("Alpha");
    const fixtureB = await createCompanyFixture("Beta");
    const adminASession = await login(fixtureA.adminEmail, fixtureA.adminPassword);
    const adminBSession = await login(fixtureB.adminEmail, fixtureB.adminPassword);

    await request(httpServer)
      .post(`/company-operations/companies/${fixtureA.companyId}/kiosks`)
      .set("Cookie", adminASession)
      .send({ name: "Alpha Kiosk", locationId: fixtureA.locationId })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${fixtureB.companyId}/kiosks`)
      .set("Cookie", adminBSession)
      .send({ name: "Beta Kiosk", locationId: fixtureB.locationId })
      .expect(201);

    const alphaList = await request(httpServer)
      .get(`/company-operations/companies/${fixtureA.companyId}/kiosks`)
      .set("Cookie", adminASession)
      .expect(200);

    expect(alphaList.body).toHaveLength(1);
    expect(alphaList.body[0].name).toBe("Alpha Kiosk");

    await request(httpServer)
      .get(`/company-operations/kiosks/${alphaList.body[0].id}`)
      .set("Cookie", adminBSession)
      .expect(403);
  });

  it("archives and unarchives kiosks and blocks archived kiosk authentication", async () => {
    const fixture = await createCompanyFixture("Alpha");
    const adminSession = await login(fixture.adminEmail, fixture.adminPassword);

    const createResponse = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/kiosks`)
      .set("Cookie", adminSession)
      .send({ name: "Lobby Kiosk", locationId: fixture.locationId })
      .expect(201);

    const kioskId = createResponse.body.kiosk.id as string;
    const kioskSecret = createResponse.body.kioskSecret as string;
    const headers = kioskHeaders(kioskId, kioskSecret);

    await request(httpServer).post("/kiosk/lookup").set(headers).send({ pin: "123456" }).expect(201);

    const archived = await request(httpServer)
      .post(`/company-operations/kiosks/${kioskId}/archive`)
      .set("Cookie", adminSession)
      .send({})
      .expect(201);

    expect(archived.body.archivedAt).toBeTruthy();

    await request(httpServer).post("/kiosk/lookup").set(headers).send({ pin: "123456" }).expect(401);

    const reactivated = await request(httpServer)
      .post(`/company-operations/kiosks/${kioskId}/unarchive`)
      .set("Cookie", adminSession)
      .send({})
      .expect(201);

    expect(reactivated.body.archivedAt).toBeNull();
    await request(httpServer).post("/kiosk/lookup").set(headers).send({ pin: "123456" }).expect(201);
  });

  it("rotates kiosk secrets and rejects the old secret after rotation", async () => {
    const fixture = await createCompanyFixture("Alpha");
    const adminSession = await login(fixture.adminEmail, fixture.adminPassword);

    const createResponse = await request(httpServer)
      .post(`/company-operations/companies/${fixture.companyId}/kiosks`)
      .set("Cookie", adminSession)
      .send({ name: "Rotate Kiosk", locationId: fixture.locationId })
      .expect(201);

    const kioskId = createResponse.body.kiosk.id as string;
    const oldSecret = createResponse.body.kioskSecret as string;

    await request(httpServer)
      .post("/kiosk/lookup")
      .set(kioskHeaders(kioskId, oldSecret))
      .send({ pin: "123456" })
      .expect(201);

    const rotateResponse = await request(httpServer)
      .post(`/company-operations/kiosks/${kioskId}/rotate-secret`)
      .set("Cookie", adminSession)
      .send({})
      .expect(201);

    expect(rotateResponse.body.kioskSecret).toBeTruthy();
    expect(rotateResponse.body.kioskSecret).not.toBe(oldSecret);
    expect(rotateResponse.body.secretHash).toBeUndefined();

    await request(httpServer)
      .post("/kiosk/lookup")
      .set(kioskHeaders(kioskId, oldSecret))
      .send({ pin: "123456" })
      .expect(401);

    await request(httpServer)
      .post("/kiosk/lookup")
      .set(kioskHeaders(kioskId, rotateResponse.body.kioskSecret as string))
      .send({ pin: "123456" })
      .expect(201);
  });

  async function createCompanyFixture(label: string) {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `${label.toLowerCase()}-owner-${randomBytes(3).toString("hex")}@example.com`;
    const ownerPassword = `Owner!${randomBytes(4).toString("hex")}`;

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({
        name: `${label} Group`,
        ownerEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: groupResponse.body.invitationToken,
        password: ownerPassword,
        fullName: `${label} Owner`
      })
      .expect(200);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminEmail = `${label.toLowerCase()}-admin-${randomBytes(3).toString("hex")}@example.com`;
    const adminPassword = `Admin!${randomBytes(4).toString("hex")}`;

    const companyResponse = await request(httpServer)
      .post(`/groups/${groupResponse.body.group.id as string}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: `${label} Company`,
        adminEmail
      })
      .expect(201);

    await request(httpServer)
      .post("/invitations/accept")
      .send({
        token: companyResponse.body.invitationToken,
        password: adminPassword,
        fullName: `${label} Admin`
      })
      .expect(200);

    const companyId = companyResponse.body.company.id as string;
    const adminSession = await login(adminEmail, adminPassword);

    const clientResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/service-clients`)
      .set("Cookie", adminSession)
      .send({ name: `${label} Client` })
      .expect(201);

    const locationResponse = await request(httpServer)
      .post(`/company-operations/companies/${companyId}/locations`)
      .set("Cookie", adminSession)
      .send({
        name: `${label} Site`,
        timezone: "America/New_York",
        serviceClientId: clientResponse.body.id
      })
      .expect(201);

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/employees`)
      .set("Cookie", adminSession)
      .send({ fullName: "Maria Gomez", pin: "123456" })
      .expect(201);

    const employee = await prisma.employee.findFirstOrThrow({
      where: { companyId, fullName: "Maria Gomez" }
    });

    await request(httpServer)
      .post(`/company-operations/companies/${companyId}/shifts`)
      .set("Cookie", adminSession)
      .send({
        employeeId: employee.id,
        serviceClientId: clientResponse.body.id,
        locationId: locationResponse.body.id,
        scheduledStartUtc: "2026-04-06T13:00:00.000Z",
        scheduledEndUtc: "2026-04-06T21:00:00.000Z"
      })
      .expect(201);

    return {
      companyId,
      locationId: locationResponse.body.id as string,
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

  function kioskHeaders(kioskId: string, kioskSecret: string) {
    return {
      "x-kiosk-id": kioskId,
      "x-kiosk-secret": kioskSecret
    };
  }
});
