import "reflect-metadata";

import { randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  CompanyRole,
  GlobalRole,
  GroupRole,
  MembershipStatus,
  PrismaClient
} from "@prisma/client";
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

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("AUTH01 admin login and company selection", () => {
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

  it("supports login, accessible companies, active company selection, and logout", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const groupA = await createGroupWithCompanies(superadminSession, "Alpha", ["Alpha One", "Alpha Two"]);
    const groupB = await createGroupWithCompanies(superadminSession, "Beta", ["Beta One"]);

    const ownerPassword = "OwnerPass!123";
    const ownerUser = await createActiveUser({
      email: "owner-alpha@example.com",
      password: ownerPassword,
      fullName: "Alpha Owner",
      groupMemberships: [
        {
          groupId: groupA.groupId,
          role: GroupRole.GROUP_OWNER
        }
      ]
    });

    const adminPassword = "AdminPass!123";
    const adminUser = await createActiveUser({
      email: "admin-alpha-one@example.com",
      password: adminPassword,
      fullName: "Alpha One Admin",
      companyMemberships: [
        {
          companyId: groupA.companyIds[0],
          role: CompanyRole.COMPANY_ADMIN
        }
      ]
    });

    await createActiveUser({
      email: "blocked-user@example.com",
      password: "BlockedPass!123",
      fullName: "No Access User"
    });

    await request(httpServer)
      .post("/auth/login")
      .send({ email: ownerUser.email, password: "wrong-password" })
      .expect(401);

    const ownerLogin = await request(httpServer)
      .post("/auth/login")
      .send({ email: ownerUser.email, password: ownerPassword })
      .expect(200);

    expect(ownerLogin.body.redirectTo).toBe("choose-company");
    expect(ownerLogin.body.accessibleCompanyCount).toBe(2);
    expect(JSON.stringify(ownerLogin.body).toLowerCase()).not.toContain("passwordhash");

    const ownerSession = extractSessionCookie(ownerLogin.headers["set-cookie"] as string[]);

    const ownerMeBefore = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSession)
      .expect(200);

    expect(ownerMeBefore.body.accessibleCompanies).toHaveLength(2);
    expect(ownerMeBefore.body.activeCompany).toBeNull();
    expect(ownerMeBefore.body.requiresCompanySelection).toBe(true);
    expect(ownerMeBefore.body.accessibleCompanies[0].accessLabel).toBe("Group owner");

    await request(httpServer)
      .post("/auth/select-company")
      .set("Cookie", ownerSession)
      .send({ companyId: groupB.companyIds[0] })
      .expect(403);

    const selected = await request(httpServer)
      .post("/auth/select-company")
      .set("Cookie", ownerSession)
      .send({ companyId: groupA.companyIds[1] })
      .expect(200);

    expect(selected.body.activeCompany.id).toBe(groupA.companyIds[1]);
    expect(selected.body.activeCompany.name).toBe("Alpha Two");

    const ownerMeAfter = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSession)
      .expect(200);

    expect(ownerMeAfter.body.activeCompany.id).toBe(groupA.companyIds[1]);
    expect(ownerMeAfter.body.requiresCompanySelection).toBe(false);

    const adminLogin = await request(httpServer)
      .post("/auth/login")
      .send({ email: adminUser.email, password: adminPassword })
      .expect(200);

    expect(adminLogin.body.redirectTo).toBe("dashboard");
    expect(adminLogin.body.activeCompanyId).toBe(groupA.companyIds[0]);

    const adminSession = extractSessionCookie(adminLogin.headers["set-cookie"] as string[]);
    const adminMe = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", adminSession)
      .expect(200);

    expect(adminMe.body.activeCompany.id).toBe(groupA.companyIds[0]);
    expect(adminMe.body.accessibleCompanies).toHaveLength(1);
    expect(adminMe.body.accessibleCompanies[0].accessRole).toBe("COMPANY_ADMIN");

    const blockedLogin = await request(httpServer)
      .post("/auth/login")
      .send({ email: "blocked-user@example.com", password: "BlockedPass!123" })
      .expect(200);

    expect(blockedLogin.body.redirectTo).toBe("blocked");
    expect(blockedLogin.body.accessibleCompanyCount).toBe(0);

    await request(httpServer).get("/auth/me").expect(401);

    await request(httpServer)
      .post("/auth/logout")
      .set("Cookie", ownerSession)
      .expect(200);

    await request(httpServer).get("/auth/me").set("Cookie", ownerSession).expect(401);

    await request(httpServer)
      .get(`/company-operations/companies/${groupA.companyIds[0]}/employees`)
      .expect(401);
  });

  async function createGroupWithCompanies(
    superadminSession: string,
    label: string,
    companyNames: string[]
  ) {
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
    const groupId = groupResponse.body.group.id as string;
    const companyIds: string[] = [];

    for (const companyName of companyNames) {
      const adminEmail = `${companyName.toLowerCase().replace(/\s+/gu, "-")}-${randomBytes(2).toString("hex")}@example.com`;
      const companyResponse = await request(httpServer)
        .post(`/groups/${groupId}/companies`)
        .set("Cookie", ownerSession)
        .send({
          name: companyName,
          adminEmail
        })
        .expect(201);

      companyIds.push(companyResponse.body.company.id as string);
    }

    return { groupId, companyIds };
  }

  async function createActiveUser(input: {
    email: string;
    password: string;
    fullName: string;
    groupMemberships?: Array<{ groupId: string; role: GroupRole }>;
    companyMemberships?: Array<{ companyId: string; role: CompanyRole }>;
  }) {
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        globalRole: GlobalRole.NONE,
        groupMemberships: input.groupMemberships
          ? {
              create: input.groupMemberships.map((membership) => ({
                groupId: membership.groupId,
                email: input.email,
                role: membership.role,
                status: MembershipStatus.ACTIVE
              }))
            }
          : undefined,
        companyMemberships: input.companyMemberships
          ? {
              create: input.companyMemberships.map((membership) => ({
                companyId: membership.companyId,
                email: input.email,
                role: membership.role,
                status: MembershipStatus.ACTIVE
              }))
            }
          : undefined
      }
    });

    return user;
  }

  function extractSessionCookie(setCookie: string[] | undefined) {
    expect(setCookie && setCookie.length > 0).toBe(true);
    const raw = setCookie?.find((value) => value.startsWith("laborledger.sid="));
    expect(raw).toBeTruthy();
    return raw?.split(";")[0] ?? "";
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return extractSessionCookie(response.headers["set-cookie"] as string[]);
  }
});
