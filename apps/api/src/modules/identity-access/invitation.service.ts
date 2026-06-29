import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { MembershipStatus } from "@prisma/client";
import { createHash } from "node:crypto";

import { validateNewPassword } from "./auth-security";
import { PasswordService } from "./password.service";
import { PrismaService } from "./prisma.service";

type AcceptInvitationInput = {
  token: string;
  password: string;
  fullName?: string;
  name?: string;
};

@Injectable()
export class InvitationService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService
  ) {}

  async acceptInvitation(input: AcceptInvitationInput) {
    const token = input.token.trim();
    const password = input.password;
    const fullName = (input.fullName ?? input.name)?.trim() || undefined;

    if (!token || !password) {
      throw new BadRequestException("Token and password are required.");
    }

    validateNewPassword(password);

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();
    const passwordHash = await this.passwordService.hashPassword(password);

    return this.prisma.$transaction(async (tx) => {
      const invitation = await tx.invitation.findUnique({
        where: {
          tokenHash
        }
      });

      if (!invitation || invitation.consumedAt || invitation.revokedAt || invitation.expiresAt <= now) {
        throw new BadRequestException("Invitation is invalid or expired.");
      }

      const user = await tx.user.upsert({
        where: {
          email: invitation.invitedEmail
        },
        update: {
          passwordHash,
          ...(fullName ? { fullName } : {})
        },
        create: {
          email: invitation.invitedEmail,
          passwordHash,
          ...(fullName ? { fullName } : {})
        }
      });

      const consumeResult = await tx.invitation.updateMany({
        where: {
          id: invitation.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: {
            gt: now
          }
        },
        data: {
          consumedAt: now,
          userId: user.id
        }
      });

      if (consumeResult.count !== 1) {
        throw new BadRequestException("Invitation has already been consumed.");
      }

      if (invitation.groupMembershipId) {
        await tx.groupMembership.update({
          where: {
            id: invitation.groupMembershipId
          },
          data: {
            userId: user.id,
            status: MembershipStatus.ACTIVE,
            email: user.email
          }
        });
      }

      if (invitation.companyMembershipId) {
        await tx.companyMembership.update({
          where: {
            id: invitation.companyMembershipId
          },
          data: {
            userId: user.id,
            status: MembershipStatus.ACTIVE,
            email: user.email
          }
        });
      }

      await tx.auditEvent.create({
        data: {
          actorUserId: user.id,
          action: "INVITATION_ACCEPTED",
          targetType: "Invitation",
          targetId: invitation.id,
          groupId: invitation.groupId,
          companyId: invitation.companyId
        }
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName
        }
      };
    });
  }
}
