import { Body, Controller, Inject, Post, Req, UseGuards } from "@nestjs/common";

import { KioskAuthGuard, type KioskContext } from "./kiosk-auth.guard";
import { KioskPunchService } from "./kiosk-punch.service";

type PunchBody = {
  pin?: string;
  action?: string;
  idempotencyKey?: string;
  deviceEventId?: string;
  deviceTimestamp?: string;
  sequence?: number;
};

type LookupBody = {
  pin?: string;
};

type AuthenticatedKioskRequest = {
  kiosk: KioskContext;
};

@Controller("kiosk")
export class KioskController {
  constructor(@Inject(KioskPunchService) private readonly kioskPunchService: KioskPunchService) {}

  @Post("lookup")
  @UseGuards(KioskAuthGuard)
  lookup(@Req() request: AuthenticatedKioskRequest, @Body() body: LookupBody) {
    return this.kioskPunchService.lookup(request.kiosk, {
      pin: body.pin ?? ""
    });
  }

  @Post("punch")
  @UseGuards(KioskAuthGuard)
  punch(@Req() request: AuthenticatedKioskRequest, @Body() body: PunchBody) {
    return this.kioskPunchService.processPunch(request.kiosk, {
      pin: body.pin ?? "",
      action: body.action ?? "",
      idempotencyKey: body.idempotencyKey ?? "",
      deviceEventId: body.deviceEventId,
      deviceTimestamp: body.deviceTimestamp,
      sequence: body.sequence
    });
  }
}
