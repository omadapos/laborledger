import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { WeeklyPeriodStatus } from "@prisma/client";

import { PrismaService } from "../identity-access/prisma.service";

import { getMondayWeekStartInTimeZone } from "./week-period";

@Injectable()
export class WeeklyPeriodLockService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertWeekOpenForShift(shift: {
    companyId: string;
    scheduledStartUtc: Date;
    timezone: string;
  }) {
    const weekStartLocalDate = getMondayWeekStartInTimeZone(
      shift.scheduledStartUtc,
      shift.timezone
    );

    await this.assertWeekOpen(shift.companyId, weekStartLocalDate);
  }

  async assertWeekOpen(companyId: string, weekStartLocalDate: string) {
    const period = await this.prisma.weeklyPeriod.findUnique({
      where: {
        companyId_weekStartLocalDate: {
          companyId,
          weekStartLocalDate
        }
      },
      select: { status: true }
    });

    if (period?.status === WeeklyPeriodStatus.CLOSED) {
      throw new BadRequestException("This workweek is closed. Reopen the week before making changes.");
    }
  }
}
