import {
  BadRequestException,
  Inject,
  Injectable
} from "@nestjs/common";
import { createHash } from "node:crypto";

import { EmailService } from "../email/email.service";
import {
  buildPasswordResetEmailBodies,
  buildPasswordResetEmailSubject
} from "./auth-email-content";
import {
  generateSecureToken,
  resolveAdminAppUrl,
  resolveAuthFromIdentity,
  validateNewPassword
} from "./auth-security";
import { PasswordService } from "./password.service";
import { PrismaService } from "./prisma.service";

const RESET_TOKEN_TTL_MINUTES = 60;
const GENERIC_RESET_MESSAGE =
  "If an account exists for that email, reset instructions have been sent.";

type RequestPasswordResetInput = {
  email: string;
  requesterIp?: string;
  userAgent?: string;
};

type ConfirmPasswordResetInput = {
  token: string;
  newPassword: string;
};

@Injectable()
export class PasswordResetService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(EmailService) private readonly emailService: EmailService
  ) {}

  async requestPasswordReset(input: RequestPasswordResetInput) {
    const email = input.email.trim().toLowerCase();

    if (!email) {
      return { message: GENERIC_RESET_MESSAGE };
    }

    const user = await this.prisma.user.findUnique({
      where: { email }
    });

    if (user) {
      const rawToken = generateSecureToken();
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
      const resetUrl = `${resolveAdminAppUrl()}/reset-password?token=${encodeURIComponent(rawToken)}`;
      const { fromEmail, fromName } = resolveAuthFromIdentity();
      const { textBody, htmlBody } = buildPasswordResetEmailBodies({
        recipientEmail: email,
        resetUrl,
        expiresMinutes: RESET_TOKEN_TTL_MINUTES
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt,
            ...(input.requesterIp ? { requesterIp: input.requesterIp } : {}),
            ...(input.userAgent ? { userAgent: input.userAgent } : {})
          }
        });

        await tx.auditEvent.create({
          data: {
            actorUserId: user.id,
            action: "PASSWORD_RESET_REQUESTED",
            targetType: "User",
            targetId: user.id,
            metadata: {
              email
            }
          }
        });
      });

      await this.emailService.send({
        to: email,
        fromEmail,
        fromName,
        subject: buildPasswordResetEmailSubject(),
        textBody,
        htmlBody
      });
    }

    return { message: GENERIC_RESET_MESSAGE };
  }

  async confirmPasswordReset(input: ConfirmPasswordResetInput) {
    const token = input.token?.trim() ?? "";

    if (!token) {
      throw new BadRequestException("Token and new password are required.");
    }

    validateNewPassword(input.newPassword);

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const now = new Date();
    const passwordHash = await this.passwordService.hashPassword(input.newPassword);

    return this.prisma.$transaction(async (tx) => {
      const resetToken = await tx.passwordResetToken.findUnique({
        where: { tokenHash }
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= now) {
        throw new BadRequestException("Password reset link is invalid or expired.");
      }

      const used = await tx.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: now }
        },
        data: {
          usedAt: now
        }
      });

      if (used.count !== 1) {
        throw new BadRequestException("Password reset link is invalid or expired.");
      }

      await tx.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash }
      });

      await tx.session.updateMany({
        where: {
          userId: resetToken.userId,
          revokedAt: null
        },
        data: {
          revokedAt: now
        }
      });

      await tx.auditEvent.create({
        data: {
          actorUserId: resetToken.userId,
          action: "PASSWORD_RESET_COMPLETED",
          targetType: "User",
          targetId: resetToken.userId
        }
      });

      return { ok: true };
    });
  }
}
