import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";

import { InvitationService } from "./invitation.service";

type AcceptInvitationBody = {
  token: string;
  password: string;
  fullName?: string;
};

@Controller("invitations")
export class InvitationsController {
  constructor(@Inject(InvitationService) private readonly invitationService: InvitationService) {}

  @Post("accept")
  @HttpCode(200)
  accept(@Body() body: AcceptInvitationBody) {
    return this.invitationService.acceptInvitation({
      token: body.token,
      password: body.password,
      ...(body.fullName ? { fullName: body.fullName } : {})
    });
  }
}
