import {
  Inject,
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException
} from "@nestjs/common";

import type { AuthenticatedPrincipal } from "./auth.types";
import { CompanyAccessService } from "./company-access.service";
import { PasswordService } from "./password.service";
import { PrismaService } from "./prisma.service";
import { SessionService } from "./session.service";

type LoginInput = {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
};

export type AuthRedirectTarget = "dashboard" | "choose-company" | "blocked";

@Injectable()
export class AuthService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService,
    @Inject(SessionService) private readonly sessionService: SessionService,
    @Inject(CompanyAccessService) private readonly companyAccessService: CompanyAccessService
  ) {}

  async login(input: LoginInput) {
    const email = input.email.trim().toLowerCase();
    const password = input.password;

    if (!email || !password) {
      throw new BadRequestException("Email and password are required.");
    }

    const user = await this.prisma.user.findUnique({
      where: {
        email
      }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const validPassword = await this.passwordService.verifyPassword(user.passwordHash, password);

    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials.");
    }

    const session = await this.sessionService.createSession({
      userId: user.id,
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      ...(input.userAgent ? { userAgent: input.userAgent } : {})
    });

    const principal = await this.companyAccessService.buildPrincipalForUser(user.id);
    principal.sessionId = session.session.id;

    const accessibleCompanies =
      await this.companyAccessService.listAccessibleCompaniesWithAccess(principal);

    let redirectTo: AuthRedirectTarget = "choose-company";
    let activeCompanyId: string | null = null;

    if (accessibleCompanies.length === 0) {
      redirectTo = "blocked";
    } else if (accessibleCompanies.length === 1) {
      activeCompanyId = accessibleCompanies[0].id;
      await this.sessionService.setActiveCompany(session.session.id, activeCompanyId);
      redirectTo = "dashboard";
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        globalRole: user.globalRole
      },
      sessionToken: session.token,
      ttlSeconds: this.sessionService.getTtlSeconds(),
      accessibleCompanyCount: accessibleCompanies.length,
      activeCompanyId,
      redirectTo
    };
  }

  async logout(sessionToken: string | undefined) {
    if (!sessionToken) {
      return;
    }

    await this.sessionService.revokeByToken(sessionToken);
  }

  async getAuthContext(principal: AuthenticatedPrincipal) {
    const user = await this.prisma.user.findUnique({
      where: {
        id: principal.userId
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        globalRole: true
      }
    });

    if (!user) {
      throw new UnauthorizedException("Authentication required.");
    }

    const accessibleCompanies =
      await this.companyAccessService.listAccessibleCompaniesWithAccess(principal);

    let activeCompanyId = principal.activeCompanyId;
    const activeCompany =
      activeCompanyId !== null
        ? (accessibleCompanies.find((company) => company.id === activeCompanyId) ?? null)
        : null;

    if (activeCompanyId && !activeCompany) {
      await this.sessionService.setActiveCompany(principal.sessionId, null);
      activeCompanyId = null;
    }

    return {
      user,
      activeCompany,
      accessibleCompanies,
      requiresCompanySelection: accessibleCompanies.length > 1 && !activeCompany
    };
  }

  async selectCompany(principal: AuthenticatedPrincipal, companyId: string) {
    const normalizedCompanyId = companyId.trim();

    if (!normalizedCompanyId) {
      throw new BadRequestException("companyId is required.");
    }

    await this.companyAccessService.assertCanAccessCompany(principal, normalizedCompanyId);

    const accessibleCompanies =
      await this.companyAccessService.listAccessibleCompaniesWithAccess(principal);
    const selectedCompany = accessibleCompanies.find(
      (company) => company.id === normalizedCompanyId
    );

    if (!selectedCompany) {
      throw new ForbiddenException("Access denied for this company.");
    }

    await this.sessionService.setActiveCompany(principal.sessionId, normalizedCompanyId);

    return {
      activeCompany: selectedCompany
    };
  }
}
