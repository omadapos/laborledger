import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import { CompanyRole, GroupRole, MembershipStatus } from "@prisma/client";

import { PrismaService } from "./prisma.service";
import { parseCookieValue, SESSION_COOKIE_NAME } from "./session-cookie";
import { SessionService } from "./session.service";
import type { RequestWithPrincipal } from "./auth.types";

@Injectable()
export class AuthSessionMiddleware implements NestMiddleware {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async use(req: RequestWithPrincipal, _res: unknown, next: () => void) {
    const cookieHeader = Array.isArray(req.headers.cookie)
      ? req.headers.cookie.join(";")
      : req.headers.cookie;

    const sessionToken = parseCookieValue(cookieHeader, SESSION_COOKIE_NAME);

    if (!sessionToken) {
      next();
      return;
    }

    req.sessionToken = sessionToken;
    const tokenHash = SessionService.tokenHash(sessionToken);

    const session = await this.prisma.session.findUnique({
      where: {
        tokenHash
      },
      include: {
        user: {
          include: {
            groupMemberships: {
              where: {
                status: MembershipStatus.ACTIVE,
                role: GroupRole.GROUP_OWNER
              }
            },
            companyMemberships: {
              where: {
                status: MembershipStatus.ACTIVE,
                role: {
                  in: [CompanyRole.COMPANY_ADMIN, CompanyRole.SUPERVISOR]
                }
              }
            }
          }
        }
      }
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date()) {
      next();
      return;
    }

    req.principal = {
      userId: session.user.id,
      email: session.user.email,
      globalRole: session.user.globalRole,
      groupOwnerGroupIds: session.user.groupMemberships.map((membership) => membership.groupId),
      companyAdminCompanyIds: session.user.companyMemberships
        .filter((membership) => membership.role === CompanyRole.COMPANY_ADMIN)
        .map((membership) => membership.companyId),
      supervisorCompanyIds: session.user.companyMemberships
        .filter((membership) => membership.role === CompanyRole.SUPERVISOR)
        .map((membership) => membership.companyId),
      sessionId: session.id,
      activeCompanyId: session.activeCompanyId
    };

    next();
  }
}
