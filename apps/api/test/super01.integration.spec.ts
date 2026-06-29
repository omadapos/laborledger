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

describe("SUPER01 platform customer onboarding", () => {
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

  it("supports superadmin customer onboarding and owner login isolation", async () => {
    const superadminSession = await login(
      process.env.PLATFORM_SUPERADMIN_EMAIL as string,
      process.env.PLATFORM_SUPERADMIN_PASSWORD as string
    );

    const ownerEmail = `owner-${randomBytes(4).toString("hex")}@example.com`;
    const ownerPassword = "OwnerTemp!123";

    const created = await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", superadminSession)
      .send({
        customerName: "Acme Fleet Services",
        companyName: "Acme Main Shop",
        ownerFullName: "Acme Owner",
        ownerEmail,
        ownerPassword
      })
      .expect(201);

    expect(created.body.customer.name).toBe("Acme Fleet Services");
    expect(created.body.company.name).toBe("Acme Main Shop");
    expect(created.body.owner.email).toBe(ownerEmail);
    expect(created.body.temporaryPassword).toBe(ownerPassword);
    expect(JSON.stringify(created.body).toLowerCase()).not.toContain("passwordhash");

    const listed = await request(httpServer)
      .get("/platform/customers")
      .set("Cookie", superadminSession)
      .expect(200);

    expect(listed.body).toHaveLength(1);
    expect(listed.body[0].name).toBe("Acme Fleet Services");
    expect(listed.body[0].primaryCompany.name).toBe("Acme Main Shop");
    expect(listed.body[0].owner.email).toBe(ownerEmail);
    expect(listed.body[0].ownerStatus).toBe("Active");
    expect(listed.body[0].lifecycleStatus).toBe("ACTIVE");

    const ownerLogin = await request(httpServer)
      .post("/auth/login")
      .send({ email: ownerEmail, password: ownerPassword })
      .expect(200);

    expect(ownerLogin.body.redirectTo).toBe("dashboard");
    expect(ownerLogin.body.activeCompanyId).toBe(created.body.company.id);

    const ownerSession = extractSessionCookie(ownerLogin.headers["set-cookie"] as string[]);
    const ownerMe = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSession)
      .expect(200);

    expect(ownerMe.body.accessibleCompanies).toHaveLength(1);
    expect(ownerMe.body.accessibleCompanies[0].id).toBe(created.body.company.id);
    expect(ownerMe.body.accessibleCompanies[0].accessRole).toBe("GROUP_OWNER");

    const otherGroup = await prisma.group.create({
      data: { name: "Other Customer Group" }
    });

    const groupOwnerPassword = "GroupOwner!123";
    const groupOwner = await createActiveUser({
      email: `group-owner-${randomBytes(3).toString("hex")}@example.com`,
      password: groupOwnerPassword,
      fullName: "Other Group Owner",
      groupMemberships: [
        {
          groupId: otherGroup.id,
          role: GroupRole.GROUP_OWNER
        }
      ]
    });

    await request(httpServer)
      .get("/platform/customers")
      .set("Cookie", await login(groupOwner.email, groupOwnerPassword))
      .expect(403);

    await request(httpServer).get("/platform/customers").expect(401);

    await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", ownerSession)
      .send({
        customerName: "Blocked Customer",
        companyName: "Blocked Co",
        ownerFullName: "Blocked Owner",
        ownerEmail: `blocked-${randomBytes(2).toString("hex")}@example.com`,
        ownerPassword: "Blocked!123"
      })
      .expect(403);

    await request(httpServer)
      .post("/platform/customers")
      .set("Cookie", superadminSession)
      .send({
        customerName: "Duplicate Email Customer",
        companyName: "Duplicate Co",
        ownerFullName: "Duplicate Owner",
        ownerEmail: ownerEmail,
        ownerPassword: "Another!123"
      })
      .expect(409);

    const meAfterLogin = await request(httpServer)
      .get("/auth/me")
      .set("Cookie", ownerSession)
      .expect(200);

    expect(JSON.stringify(meAfterLogin.body).toLowerCase()).not.toContain("passwordhash");
  });

  async function createActiveUser(input: {
    email: string;
    password: string;
    fullName: string;
    groupMemberships?: Array<{ groupId: string; role: GroupRole }>;
    companyMemberships?: Array<{ companyId: string; role: CompanyRole }>;
  }) {
    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS);

    return prisma.user.create({
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
