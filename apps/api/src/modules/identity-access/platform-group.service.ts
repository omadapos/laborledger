import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { CompanyRole, GlobalRole, GroupRole, GroupStatus, MembershipStatus } from "@prisma/client";
import { createHash, randomBytes } from "node:crypto";

import type { AuthenticatedPrincipal } from "./auth.types";
import { PrismaService } from "./prisma.service";

type CreateGroupInput = {
  name: string;
  ownerEmail: string;
};

type CreateCompanyInput = {
  groupId: string;
  companyName: string;
  adminEmail: string;
  adminFullName?: string;
};

@Injectable()
export class PlatformGroupService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async createGroupWithOwnerInvitation(principal: AuthenticatedPrincipal, input: CreateGroupInput) {
    const groupName = input.name.trim();
    const ownerEmail = input.ownerEmail.trim().toLowerCase();

    if (!groupName || !ownerEmail) {
      throw new BadRequestException("Group name and owner email are required.");
    }

    const invitationToken = randomBytes(32).toString("base64url");
    const invitationHash = createHash("sha256").update(invitationToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const created = await this.prisma.$transaction(async (tx) => {
      const group = await tx.group.create({
        data: {
          name: groupName
        }
      });

      const membership = await tx.groupMembership.create({
        data: {
          groupId: group.id,
          email: ownerEmail,
          role: GroupRole.GROUP_OWNER,
          status: MembershipStatus.INVITED
        }
      });

      await tx.invitation.create({
        data: {
          tokenHash: invitationHash,
          invitedEmail: ownerEmail,
          expiresAt,
          createdByUserId: principal.userId,
          groupId: group.id,
          groupMembershipId: membership.id
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "GROUP_CREATED",
          targetType: "Group",
          targetId: group.id,
          groupId: group.id,
          metadata: {
            ownerEmail
          }
        }
      });

      return { group };
    });

    return {
      group: created.group,
      invitationToken,
      expiresAt
    };
  }

  async createCompanyWithAdminInvitation(
    principal: AuthenticatedPrincipal,
    input: CreateCompanyInput
  ) {
    const groupId = input.groupId;
    const companyName = input.companyName.trim();
    const adminEmail = input.adminEmail.trim().toLowerCase();
    const adminFullName = input.adminFullName?.trim() ?? "";

    if (!companyName || !adminEmail) {
      throw new BadRequestException("Company name and admin email are required.");
    }

    const canManageGroup =
      principal.globalRole === GlobalRole.PLATFORM_SUPERADMIN ||
      principal.groupOwnerGroupIds.includes(groupId);

    if (!canManageGroup) {
      throw new ForbiddenException("You cannot create companies for this group.");
    }

    const group = await this.prisma.group.findUnique({
      where: { id: groupId },
      select: { id: true, status: true }
    });

    if (!group) {
      throw new NotFoundException("Customer account not found.");
    }

    if (group.status !== GroupStatus.ACTIVE) {
      throw new BadRequestException("Companies can only be created for active customer accounts.");
    }

    const duplicateCompany = await this.prisma.company.findFirst({
      where: {
        groupId,
        name: {
          equals: companyName,
          mode: "insensitive"
        }
      },
      select: { id: true }
    });

    if (duplicateCompany) {
      throw new ConflictException("A company with this name already exists for this customer account.");
    }

    const invitationToken = randomBytes(32).toString("base64url");
    const invitationHash = createHash("sha256").update(invitationToken).digest("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7);

    const created = await this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({
        data: {
          groupId,
          name: companyName
        }
      });

      const membership = await tx.companyMembership.create({
        data: {
          companyId: company.id,
          email: adminEmail,
          role: CompanyRole.COMPANY_ADMIN,
          status: MembershipStatus.INVITED
        }
      });

      await tx.invitation.create({
        data: {
          tokenHash: invitationHash,
          invitedEmail: adminEmail,
          expiresAt,
          createdByUserId: principal.userId,
          groupId,
          companyId: company.id,
          companyMembershipId: membership.id
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: principal.userId,
          action: "COMPANY_CREATED",
          targetType: "Company",
          targetId: company.id,
          groupId,
          companyId: company.id,
          metadata: {
            adminEmail,
            ...(adminFullName ? { adminFullName } : {})
          }
        }
      });

      return { company };
    });

    return {
      company: created.company,
      invitationToken,
      expiresAt
    };
  }
}
