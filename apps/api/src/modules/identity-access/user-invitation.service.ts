import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import {
  CompanyRole,
  InvitationKind,
  MembershipStatus,
  type Invitation
} from "@prisma/client";
import { createHash } from "node:crypto";

import { EmailService } from "../email/email.service";
import {
  buildInvitationEmailBodies,
  buildInvitationEmailSubject
} from "./auth-email-content";
import {
  generateSecureToken,
  resolveAdminAppUrl,
  resolveAuthFromIdentity
} from "./auth-security";
import type { AuthenticatedPrincipal } from "./auth.types";
import { CompanyScopeService } from "./company-scope.service";
import { PrismaService } from "./prisma.service";

const INVITE_TTL_DAYS = 7;

type CreateUserInvitationInput = {
  companyId: string;
  email: string;
  role: "COMPANY_ADMIN";
};

@Injectable()
export class UserInvitationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  async listCompanyInvitations(principal: AuthenticatedPrincipal, companyId: string) {
    if (!companyId?.trim()) {
      throw new BadRequestException("companyId is required.");
    }

    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);

    const invitations = await this.prisma.invitation.findMany({
      where: {
        companyId: company.id,
        kind: InvitationKind.COMPANY_ADMIN_ACCESS
      },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        companyMembership: { select: { role: true } }
      },
      orderBy: [{ createdAt: "desc" }]
    });

    return invitations.map((invitation) => this.mapInvitation(invitation));
  }

  async createCompanyInvitation(principal: AuthenticatedPrincipal, input: CreateUserInvitationInput) {
    const company = await this.companyScopeService.requireManagementCompany(principal, input.companyId);
    const email = input.email.trim().toLowerCase();

    if (!email) {
      throw new BadRequestException("Email is required.");
    }

    if (input.role !== "COMPANY_ADMIN") {
      throw new BadRequestException("Only COMPANY_ADMIN invitations are supported in AUTH02.");
    }

    const existingActiveMembership = await this.prisma.companyMembership.findFirst({
      where: {
        companyId: company.id,
        email,
        status: MembershipStatus.ACTIVE
      }
    });

    if (existingActiveMembership) {
      throw new BadRequestException("This user already has active access to the company.");
    }

    const rawToken = generateSecureToken();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);
    const acceptUrl = `${resolveAdminAppUrl()}/accept-invite?token=${encodeURIComponent(rawToken)}`;

    const invitation = await this.prisma.$transaction(async (tx) => {
      const now = new Date();

      await tx.invitation.updateMany({
        where: {
          companyId: company.id,
          invitedEmail: email,
          kind: InvitationKind.COMPANY_ADMIN_ACCESS,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: {
          revokedAt: now
        }
      });

      const membership = await tx.companyMembership.upsert({
        where: {
          companyId_email: {
            companyId: company.id,
            email
          }
        },
        update: {
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.INVITED,
          userId: null
        },
        create: {
          companyId: company.id,
          email,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.INVITED
        }
      });

      const created = await tx.invitation.create({
        data: {
          tokenHash,
          invitedEmail: email,
          expiresAt,
          createdByUserId: principal.userId,
          groupId: company.groupId,
          companyId: company.id,
          companyMembershipId: membership.id,
          kind: InvitationKind.COMPANY_ADMIN_ACCESS
        },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          companyMembership: { select: { role: true } }
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "USER_INVITATION_CREATED",
          targetType: "Invitation",
          targetId: created.id,
          groupId: company.groupId,
          companyId: company.id,
          metadata: {
            email,
            role: CompanyRole.COMPANY_ADMIN
          }
        }
      });

      return created;
    });

    const { fromEmail, fromName } = resolveAuthFromIdentity();
    const { textBody, htmlBody } = buildInvitationEmailBodies({
      recipientEmail: email,
      acceptUrl,
      companyName: company.name,
      roleLabel: "Company Administrator",
      expiresDays: INVITE_TTL_DAYS
    });

    await this.emailService.send({
      to: email,
      fromEmail,
      fromName,
      subject: buildInvitationEmailSubject(),
      textBody,
      htmlBody
    });

    return this.mapInvitation(invitation);
  }

  async revokeInvitation(principal: AuthenticatedPrincipal, invitationId: string) {
    const invitation = await this.prisma.invitation.findUnique({
      where: { id: invitationId },
      include: {
        createdBy: { select: { id: true, fullName: true, email: true } },
        companyMembership: { select: { role: true } }
      }
    });

    if (!invitation || invitation.kind !== InvitationKind.COMPANY_ADMIN_ACCESS || !invitation.companyId) {
      throw new NotFoundException("Invitation not found.");
    }

    await this.companyScopeService.requireManagementCompany(principal, invitation.companyId);

    const now = new Date();
    if (invitation.consumedAt) {
      throw new BadRequestException("Accepted invitations cannot be revoked.");
    }

    if (invitation.revokedAt) {
      return this.mapInvitation(invitation);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          consumedAt: null,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      if (result.count !== 1) {
        throw new BadRequestException("Invitation is no longer pending.");
      }

      if (invitation.companyMembershipId) {
        await tx.companyMembership.updateMany({
          where: {
            id: invitation.companyMembershipId,
            status: MembershipStatus.INVITED
          },
          data: {
            status: MembershipStatus.REVOKED
          }
        });
      }

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "USER_INVITATION_REVOKED",
          targetType: "Invitation",
          targetId: invitation.id,
          groupId: invitation.groupId,
          companyId: invitation.companyId,
          metadata: {
            email: invitation.invitedEmail
          }
        }
      });

      return tx.invitation.findUnique({
        where: { id: invitation.id },
        include: {
          createdBy: { select: { id: true, fullName: true, email: true } },
          companyMembership: { select: { role: true } }
        }
      });
    });

    if (!updated) {
      throw new NotFoundException("Invitation not found.");
    }

    return this.mapInvitation(updated);
  }

  private mapInvitation(
    invitation: Invitation & {
      createdBy: { id: string; fullName: string | null; email: string };
      companyMembership: { role: CompanyRole } | null;
    }
  ) {
    const now = new Date();
    let status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED" = "PENDING";

    if (invitation.consumedAt) {
      status = "ACCEPTED";
    } else if (invitation.revokedAt) {
      status = "REVOKED";
    } else if (invitation.expiresAt <= now) {
      status = "EXPIRED";
    }

    return {
      id: invitation.id,
      email: invitation.invitedEmail,
      role: invitation.companyMembership?.role ?? CompanyRole.COMPANY_ADMIN,
      status,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.consumedAt,
      revokedAt: invitation.revokedAt,
      createdAt: invitation.createdAt,
      invitedBy: invitation.createdBy
    };
  }
}
