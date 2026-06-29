import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";

import { CurrentPrincipal } from "./current-principal.decorator";
import { AuthenticatedGuard } from "./authenticated.guard";
import type { AuthenticatedPrincipal, RequestWithPrincipal } from "./auth.types";
import { AuthService } from "./auth.service";
import { InvitationService } from "./invitation.service";
import { PasswordResetService } from "./password-reset.service";
import { UserInvitationService } from "./user-invitation.service";
import {
  serializeExpiredSessionCookie,
  serializeSessionCookie
} from "./session-cookie";

type LoginBody = {
  email: string;
  password: string;
};

type SelectCompanyBody = {
  companyId: string;
};

type PasswordResetRequestBody = {
  email: string;
};

type PasswordResetConfirmBody = {
  token: string;
  newPassword: string;
};

type CreateInvitationBody = {
  companyId: string;
  email: string;
  role: "COMPANY_ADMIN";
};

type AcceptInvitationBody = {
  token: string;
  password: string;
  name?: string;
  fullName?: string;
};

@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Inject(PasswordResetService) private readonly passwordResetService: PasswordResetService,
    @Inject(UserInvitationService) private readonly userInvitationService: UserInvitationService,
    @Inject(InvitationService) private readonly invitationService: InvitationService
  ) {}

  @Post("login")
  @HttpCode(200)
  async login(
    @Body() body: LoginBody,
    @Req() req: RequestWithPrincipal & { ip?: string },
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }
  ) {
    const userAgent = Array.isArray(req.headers["user-agent"])
      ? req.headers["user-agent"][0]
      : req.headers["user-agent"];

    const result = await this.authService.login({
      email: body.email,
      password: body.password,
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(userAgent ? { userAgent } : {})
    });

    response.setHeader(
      "Set-Cookie",
      serializeSessionCookie(result.sessionToken, result.ttlSeconds)
    );

    return {
      user: result.user,
      accessibleCompanyCount: result.accessibleCompanyCount,
      activeCompanyId: result.activeCompanyId,
      redirectTo: result.redirectTo
    };
  }

  @Post("logout")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  async logout(
    @Req() req: RequestWithPrincipal,
    @Res({ passthrough: true }) response: { setHeader(name: string, value: string): void }
  ) {
    await this.authService.logout(req.sessionToken);
    response.setHeader("Set-Cookie", serializeExpiredSessionCookie());

    return {
      ok: true
    };
  }

  @Get("me")
  @UseGuards(AuthenticatedGuard)
  me(@CurrentPrincipal() principal: AuthenticatedPrincipal) {
    return this.authService.getAuthContext(principal);
  }

  @Post("select-company")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  selectCompany(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: SelectCompanyBody
  ) {
    return this.authService.selectCompany(principal, body.companyId);
  }

  @Post("password-reset/request")
  @HttpCode(200)
  requestPasswordReset(
    @Body() body: PasswordResetRequestBody,
    @Req() req: RequestWithPrincipal & { ip?: string }
  ) {
    const userAgent = Array.isArray(req.headers["user-agent"])
      ? req.headers["user-agent"][0]
      : req.headers["user-agent"];

    return this.passwordResetService.requestPasswordReset({
      email: body.email,
      ...(req.ip ? { requesterIp: req.ip } : {}),
      ...(userAgent ? { userAgent } : {})
    });
  }

  @Post("password-reset/confirm")
  @HttpCode(200)
  confirmPasswordReset(@Body() body: PasswordResetConfirmBody) {
    return this.passwordResetService.confirmPasswordReset({
      token: body.token,
      newPassword: body.newPassword
    });
  }

  @Get("invitations")
  @UseGuards(AuthenticatedGuard)
  listInvitations(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Query("companyId") companyId: string
  ) {
    return this.userInvitationService.listCompanyInvitations(principal, companyId);
  }

  @Post("invitations")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(201)
  createInvitation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Body() body: CreateInvitationBody
  ) {
    return this.userInvitationService.createCompanyInvitation(principal, body);
  }

  @Post("invitations/accept")
  @HttpCode(200)
  acceptInvitation(@Body() body: AcceptInvitationBody) {
    return this.invitationService.acceptInvitation(body);
  }

  @Post("invitations/:invitationId/revoke")
  @UseGuards(AuthenticatedGuard)
  @HttpCode(200)
  revokeInvitation(
    @CurrentPrincipal() principal: AuthenticatedPrincipal,
    @Param("invitationId") invitationId: string
  ) {
    return this.userInvitationService.revokeInvitation(principal, invitationId);
  }
}
