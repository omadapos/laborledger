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

describe("service catalog foundation", () => {
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

  it("supports company-scoped service catalog CRUD with fixed minor-unit pricing", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const setupA = await createCompanyWithAdmin(superadminSession, "Alpha", "alpha-admin");
    const setupB = await createCompanyWithAdmin(superadminSession, "Beta", "beta-admin");
    const adminASession = await login(setupA.adminEmail, setupA.adminPassword);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .send({ name: "   ", fixedPriceMinor: 12500 })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .send({ name: "Detailing", fixedPriceMinor: 0 })
      .expect(400);

    const createResponse = await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .send({
        name: "Interior Detailing",
        description: "Full interior clean",
        category: "Detailing",
        fixedPriceMinor: 12500,
        currencyCode: "USD"
      })
      .expect(201);

    const itemId = createResponse.body.id as string;
    expect(createResponse.body.fixedPriceMinor).toBe(12500);
    expect(createResponse.body.currencyCode).toBe("USD");

    const activeList = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(activeList.body).toHaveLength(1);

    await request(httpServer)
      .post(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .send({ name: "Interior Detailing", fixedPriceMinor: 9900 })
      .expect(400);

    await request(httpServer)
      .post(`/company-operations/service-catalog/${itemId}`)
      .set("Cookie", adminASession)
      .send({
        name: "Interior Detailing Plus",
        description: "Updated package",
        category: "Detailing",
        fixedPriceMinor: 14900
      })
      .expect(201);

    const detail = await request(httpServer)
      .get(`/company-operations/service-catalog/${itemId}`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(detail.body.name).toBe("Interior Detailing Plus");
    expect(detail.body.fixedPriceMinor).toBe(14900);

    const archived = await request(httpServer)
      .post(`/company-operations/service-catalog/${itemId}/archive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);
    expect(archived.body.archivedAt).toBeTruthy();

    const activeAfterArchive = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(activeAfterArchive.body).toHaveLength(0);

    const includeArchived = await request(httpServer)
      .get(`/company-operations/companies/${setupA.companyId}/service-catalog?includeArchived=true`)
      .set("Cookie", adminASession)
      .expect(200);
    expect(includeArchived.body).toHaveLength(1);

    const reactivated = await request(httpServer)
      .post(`/company-operations/service-catalog/${itemId}/unarchive`)
      .set("Cookie", adminASession)
      .send({})
      .expect(201);
    expect(reactivated.body.archivedAt).toBeNull();

    await request(httpServer)
      .get(`/company-operations/service-catalog/${itemId}`)
      .set("Cookie", await login(setupB.adminEmail, setupB.adminPassword))
      .expect(403);

    await request(httpServer)
      .post(`/company-operations/companies/${setupB.companyId}/service-catalog`)
      .set("Cookie", adminASession)
      .send({ name: "Cross Tenant Service", fixedPriceMinor: 5000 })
      .expect(403);

    const auditActions = await prisma.auditEvent.findMany({
      where: { companyId: setupA.companyId, targetType: "ServiceCatalogItem" },
      select: { action: true }
    });
    expect(auditActions.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        "SERVICE_CATALOG_ITEM_CREATED",
        "SERVICE_CATALOG_ITEM_UPDATED",
        "SERVICE_CATALOG_ITEM_ARCHIVED",
        "SERVICE_CATALOG_ITEM_UNARCHIVED"
      ])
    );
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
