import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";

import { PrismaService } from "./prisma.service";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

@Injectable()
export class SessionService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  static tokenHash(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  getTtlSeconds(): number {
    return SESSION_TTL_SECONDS;
  }

  async createSession(input: { userId: string; ipAddress?: string; userAgent?: string }) {
    const token = randomBytes(32).toString("base64url");
    const tokenHash = SessionService.tokenHash(token);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    const session = await this.prisma.session.create({
      data: {
        userId: input.userId,
        tokenHash,
        expiresAt,
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        ...(input.userAgent ? { userAgent: input.userAgent } : {})
      }
    });

    return {
      token,
      session,
      expiresAt
    };
  }

  async revokeByToken(token: string): Promise<void> {
    const tokenHash = SessionService.tokenHash(token);

    await this.prisma.session.updateMany({
      where: {
        tokenHash,
        revokedAt: null
      },
      data: {
        revokedAt: new Date()
      }
    });
  }

  async setActiveCompany(sessionId: string, companyId: string | null): Promise<void> {
    await this.prisma.session.update({
      where: {
        id: sessionId
      },
      data: {
        activeCompanyId: companyId
      }
    });
  }
}
