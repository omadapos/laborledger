import { Inject, Injectable, OnModuleInit } from "@nestjs/common";
import { GlobalRole } from "@prisma/client";

import { PasswordService } from "./password.service";
import { PrismaService } from "./prisma.service";

@Injectable()
export class SuperadminBootstrapService implements OnModuleInit {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(PasswordService) private readonly passwordService: PasswordService
  ) {}

  async onModuleInit() {
    await this.ensureSuperadminFromEnvironment();
  }

  private async ensureSuperadminFromEnvironment() {
    const email = process.env.PLATFORM_SUPERADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.PLATFORM_SUPERADMIN_PASSWORD?.trim();
    const fullName = process.env.PLATFORM_SUPERADMIN_NAME?.trim();

    if (!email || !password) {
      return;
    }

    const passwordHash = await this.passwordService.hashPassword(password);

    await this.prisma.user.upsert({
      where: {
        email
      },
      update: {
        passwordHash,
        ...(fullName ? { fullName } : {}),
        globalRole: GlobalRole.PLATFORM_SUPERADMIN
      },
      create: {
        email,
        passwordHash,
        ...(fullName ? { fullName } : {}),
        globalRole: GlobalRole.PLATFORM_SUPERADMIN
      }
    });
  }
}
