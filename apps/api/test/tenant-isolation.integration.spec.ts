import "reflect-metadata";

import { createHash, randomBytes } from "node:crypto";

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

describe("identity and multi-tenant isolation", () => {
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

  it("enforces group and company tenant isolation rules", async () => {
    const superadminSession = await loginAsSuperadmin();

    const ownerEmail = `owner-${randomBytes(4).toString("hex")}@example.com`;
    const ownerPassword = "OwnerPass!123";

    const groupResponse = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({
        name: "Group A",
        ownerEmail
      })
      .expect(201);

    const ownerInvitationToken = groupResponse.body.invitationToken as string;
    const groupId = groupResponse.body.group.id as string;

    const ownerInvitationRow = await prisma.invitation.findFirstOrThrow({
      where: { groupId }
    });

    expect(ownerInvitationRow.tokenHash).toBe(
      createHash("sha256").update(ownerInvitationToken).digest("hex")
    );

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: ownerInvitationToken, password: ownerPassword, fullName: "Owner A" })
      .expect(200);

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: ownerInvitationToken, password: ownerPassword })
      .expect(400);

    const ownerSession = await login(ownerEmail, ownerPassword);

    const adminOneEmail = `admin-one-${randomBytes(4).toString("hex")}@example.com`;
    const adminTwoEmail = `admin-two-${randomBytes(4).toString("hex")}@example.com`;

    const companyOne = await request(httpServer)
      .post(`/groups/${groupId}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: "Company A1", adminEmail: adminOneEmail })
      .expect(201);

    const companyTwo = await request(httpServer)
      .post(`/groups/${groupId}/companies`)
      .set("Cookie", ownerSession)
      .send({ name: "Company A2", adminEmail: adminTwoEmail })
      .expect(201);

    const companyOneId = companyOne.body.company.id as string;
    const companyTwoId = companyTwo.body.company.id as string;

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: companyOne.body.invitationToken, password: "AdminOne!123" })
      .expect(200);

    await request(httpServer)
      .post("/invitations/accept")
      .send({ token: companyTwo.body.invitationToken, password: "AdminTwo!123" })
      .expect(200);

    const ownerCompanies = await request(httpServer)
      .get("/companies")
      .set("Cookie", ownerSession)
      .expect(200);

    expect(ownerCompanies.body).toHaveLength(2);

    const adminOneSession = await login(adminOneEmail, "AdminOne!123");

    await request(httpServer)
      .get(`/companies/${companyOneId}`)
      .set("Cookie", adminOneSession)
      .expect(200);

    await request(httpServer)
      .get(`/companies/${companyTwoId}`)
      .set("Cookie", adminOneSession)
      .expect(403);

    const secondGroup = await request(httpServer)
      .post("/platform/groups")
      .set("Cookie", superadminSession)
      .send({
        name: "Group B",
        ownerEmail: `owner-b-${randomBytes(4).toString("hex")}@example.com`
      })
      .expect(201);

    const groupBId = secondGroup.body.group.id as string;

    await request(httpServer)
      .post(`/groups/${groupBId}/companies`)
      .set("Cookie", superadminSession)
      .send({
        name: "Company B1",
        adminEmail: `admin-b-${randomBytes(4).toString("hex")}@example.com`
      })
      .expect(201);

    await request(httpServer)
      .post(`/groups/${groupBId}/companies`)
      .set("Cookie", ownerSession)
      .send({
        name: "Cross tenant",
        adminEmail: `cross-${randomBytes(4).toString("hex")}@example.com`
      })
      .expect(403);
  });

  async function loginAsSuperadmin() {
    return login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    const cookies = response.headers["set-cookie"] as string[] | undefined;
    expect(cookies && cookies.length > 0).toBe(true);
    const cookie = cookies?.[0] ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=Lax");
    return cookie;
  }
});
