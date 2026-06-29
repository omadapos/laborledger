import "reflect-metadata";

import { createHash, randomBytes } from "node:crypto";

import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  CompanyRole,
  GlobalRole,
  GroupRole,
  InvitationKind,
  MembershipStatus,
  PrismaClient
} from "@prisma/client";
import * as argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { resetIntegrationDatabase } from "./integration-test-db";

import { AppModule } from "../src/modules/app.module";
import { ConsoleEmailProviderService } from "../src/modules/email/console-email-provider.service";

const dbUrl =
  process.env.DATABASE_URL ??
  "postgresql://laborledger:laborledger@localhost:55432/laborledger?schema=public";

process.env.DATABASE_URL = dbUrl;
process.env.PLATFORM_SUPERADMIN_EMAIL = "superadmin@laborledger.local";
process.env.PLATFORM_SUPERADMIN_PASSWORD = "SuperAdmin!123";
process.env.PLATFORM_SUPERADMIN_NAME = "Platform Superadmin";
process.env.EMAIL_PROVIDER = "console";
process.env.ADMIN_APP_URL = "http://localhost:3000";

const prisma = new PrismaClient({ datasourceUrl: dbUrl });

const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1
} as const;

describe("AUTH02 password reset and user invitations", () => {
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication["getHttpServer"]>;
  let emailSendSpy: ReturnType<typeof vi.spyOn>;

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, { logger: false });
    await app.init();
    httpServer = app.getHttpServer();

    const emailProvider = app.get(ConsoleEmailProviderService);
    emailSendSpy = vi.spyOn(emailProvider, "send").mockResolvedValue({
      success: true,
      provider: "console",
      providerMessageId: "console-test"
    });
  });

  beforeEach(async () => {
    emailSendSpy.mockClear();

    await resetIntegrationDatabase(prisma);

    });

  afterAll(async () => {
    emailSendSpy.mockRestore();
    await app.close();
    await prisma.$disconnect();
  });

  it("returns generic success for password reset regardless of email existence", async () => {
    const password = "ResetUser!123";
    await createActiveUser({
      email: "reset-user@example.com",
      password,
      fullName: "Reset User",
      companyMemberships: []
    });

    const existing = await request(httpServer)
      .post("/auth/password-reset/request")
      .send({ email: "reset-user@example.com" })
      .expect(200);

    const missing = await request(httpServer)
      .post("/auth/password-reset/request")
      .send({ email: "missing-user@example.com" })
      .expect(200);

    expect(existing.body.message).toContain("If an account exists");
    expect(missing.body.message).toBe(existing.body.message);
    expect(emailSendSpy).toHaveBeenCalledTimes(1);
  });

  it("stores hashed reset tokens, rejects weak passwords, and rotates credentials", async () => {
    const oldPassword = "OldPass!123";
    const newPassword = "NewPass!456";
    const user = await createActiveUser({
      email: "rotate-user@example.com",
      password: oldPassword,
      fullName: "Rotate User",
      companyMemberships: []
    });

    await request(httpServer)
      .post("/auth/password-reset/request")
      .send({ email: user.email })
      .expect(200);

    const storedTokens = await prisma.passwordResetToken.findMany({
      where: { userId: user.id }
    });

    expect(storedTokens).toHaveLength(1);
    expect(storedTokens[0]?.tokenHash).toMatch(/^[a-f0-9]{64}$/u);
    expect(JSON.stringify(storedTokens)).not.toContain("base64");

    const rawToken = randomBytes(32).toString("base64url");

    await request(httpServer)
      .post("/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword: "weak" })
      .expect(400);

    await request(httpServer)
      .post("/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword })
      .expect(400);

    const loginBefore = await request(httpServer)
      .post("/auth/login")
      .send({ email: user.email, password: oldPassword })
      .expect(200);

    const sessionCookie = extractSessionCookie(loginBefore.headers["set-cookie"] as string[]);

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.update({
      where: { id: storedTokens[0]!.id },
      data: { tokenHash }
    });

    await request(httpServer)
      .post("/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword })
      .expect(200);

    await request(httpServer)
      .post("/auth/password-reset/confirm")
      .send({ token: rawToken, newPassword: "AnotherPass!789" })
      .expect(400);

    await request(httpServer)
      .post("/auth/login")
      .send({ email: user.email, password: oldPassword })
      .expect(401);

    await request(httpServer)
      .post("/auth/login")
      .send({ email: user.email, password: newPassword })
      .expect(200);

    await request(httpServer).get("/auth/me").set("Cookie", sessionCookie).expect(401);

    const expiredToken = randomBytes(32).toString("base64url");
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
        expiresAt: new Date(Date.now() - 60_000)
      }
    });

    await request(httpServer)
      .post("/auth/password-reset/confirm")
      .send({ token: expiredToken, newPassword: "ExpiredPass!123" })
      .expect(400);
  });

  it("supports company admin invitations with authorization and lifecycle rules", async () => {
    const fixture = await createCompanyFixture("InviteCo");

    const supervisor = await createActiveUser({
      email: "supervisor@example.com",
      password: "Supervisor!123",
      fullName: "Site Supervisor",
      companyMemberships: [{ companyId: fixture.companyId, role: CompanyRole.SUPERVISOR }]
    });

    const supervisorSession = await login(supervisor.email, "Supervisor!123");

    await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", supervisorSession)
      .send({
        companyId: fixture.companyId,
        email: "new-admin@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(403);

    const otherCompany = await createCompanyFixture("OtherCo");
    await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", fixture.adminSession)
      .send({
        companyId: otherCompany.companyId,
        email: "cross@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(403);

    const firstInvite = await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", fixture.adminSession)
      .send({
        companyId: fixture.companyId,
        email: "new-admin@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(201);

    expect(firstInvite.body.status).toBe("PENDING");
    expect(emailSendSpy).toHaveBeenCalled();

    const storedInvite = await prisma.invitation.findFirst({
      where: { invitedEmail: "new-admin@example.com", kind: InvitationKind.COMPANY_ADMIN_ACCESS }
    });

    expect(storedInvite?.tokenHash).toMatch(/^[a-f0-9]{64}$/u);

    const replacementInvite = await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", fixture.adminSession)
      .send({
        companyId: fixture.companyId,
        email: "new-admin@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(201);

    expect(replacementInvite.body.id).not.toBe(firstInvite.body.id);

    const revokedFirst = await prisma.invitation.findUnique({ where: { id: firstInvite.body.id } });
    expect(revokedFirst?.revokedAt).not.toBeNull();

    const rawToken = randomBytes(32).toString("base64url");
    await prisma.invitation.update({
      where: { id: replacementInvite.body.id },
      data: { tokenHash: createHash("sha256").update(rawToken).digest("hex") }
    });

    const accept = await request(httpServer)
      .post("/auth/invitations/accept")
      .send({ token: rawToken, password: "InvitePass!123", name: "New Admin" })
      .expect(200);

    expect(accept.body.user.email).toBe("new-admin@example.com");

    const membership = await prisma.companyMembership.findFirst({
      where: { companyId: fixture.companyId, email: "new-admin@example.com" }
    });

    expect(membership?.status).toBe(MembershipStatus.ACTIVE);
    expect(membership?.userId).toBeTruthy();

    await request(httpServer)
      .post("/auth/invitations/accept")
      .send({ token: rawToken, password: "InvitePass!456" })
      .expect(400);

    await request(httpServer)
      .post(`/auth/invitations/${replacementInvite.body.id}/revoke`)
      .set("Cookie", fixture.adminSession)
      .send()
      .expect(400);

    const list = await request(httpServer)
      .get(`/auth/invitations?companyId=${fixture.companyId}`)
      .set("Cookie", fixture.adminSession)
      .expect(200);

    expect(list.body.some((row: { status: string }) => row.status === "ACCEPTED")).toBe(true);

    const pendingInvite = await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", fixture.adminSession)
      .send({
        companyId: fixture.companyId,
        email: "revoke-me@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(201);

    await request(httpServer)
      .post(`/auth/invitations/${pendingInvite.body.id}/revoke`)
      .set("Cookie", fixture.adminSession)
      .send()
      .expect(200);

    const revokedToken = randomBytes(32).toString("base64url");
    await prisma.invitation.update({
      where: { id: pendingInvite.body.id },
      data: { tokenHash: createHash("sha256").update(revokedToken).digest("hex") }
    });

    await request(httpServer)
      .post("/auth/invitations/accept")
      .send({ token: revokedToken, password: "RevokedPass!123" })
      .expect(400);

    const expiredToken = randomBytes(32).toString("base64url");
    const expiredInvite = await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", fixture.adminSession)
      .send({
        companyId: fixture.companyId,
        email: "expired@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(201);

    await prisma.invitation.update({
      where: { id: expiredInvite.body.id },
      data: {
        tokenHash: createHash("sha256").update(expiredToken).digest("hex"),
        expiresAt: new Date(Date.now() - 60_000)
      }
    });

    await request(httpServer)
      .post("/auth/invitations/accept")
      .send({ token: expiredToken, password: "ExpiredPass!123" })
      .expect(400);
  });

  it("links invitations to existing users by email", async () => {
    const fixture = await createCompanyFixture("ExistingCo");
    const existingPassword = "Existing!123";

    await createActiveUser({
      email: "existing-admin@example.com",
      password: existingPassword,
      fullName: "Existing Admin"
    });

    const invite = await request(httpServer)
      .post("/auth/invitations")
      .set("Cookie", fixture.adminSession)
      .send({
        companyId: fixture.companyId,
        email: "existing-admin@example.com",
        role: "COMPANY_ADMIN"
      })
      .expect(201);

    const rawToken = randomBytes(32).toString("base64url");
    await prisma.invitation.update({
      where: { id: invite.body.id },
      data: { tokenHash: createHash("sha256").update(rawToken).digest("hex") }
    });

    await request(httpServer)
      .post("/auth/invitations/accept")
      .send({ token: rawToken, password: "UpdatedPass!456" })
      .expect(200);

    await request(httpServer)
      .post("/auth/login")
      .send({ email: "existing-admin@example.com", password: existingPassword })
      .expect(401);

    await request(httpServer)
      .post("/auth/login")
      .send({ email: "existing-admin@example.com", password: "UpdatedPass!456" })
      .expect(200);
  });

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
    const raw = setCookie?.find((value) => value.startsWith("laborledger.sid="));
    return raw?.split(";")[0] ?? "";
  }

  async function login(email: string, password: string) {
    const response = await request(httpServer).post("/auth/login").send({ email, password }).expect(200);
    return extractSessionCookie(response.headers["set-cookie"] as string[]);
  }
});
