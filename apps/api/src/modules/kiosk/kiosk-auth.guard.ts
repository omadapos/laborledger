import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import * as argon2 from "argon2";

import { PrismaService } from "../identity-access/prisma.service";

export type KioskContext = {
  id: string;
  groupId: string;
  companyId: string;
  locationId: string;
  name: string;
};

@Injectable()
export class KioskAuthGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      kiosk?: KioskContext;
    }>();

    const kioskId = this.readHeader(request.headers["x-kiosk-id"]);
    const kioskSecret = this.readHeader(request.headers["x-kiosk-secret"]);

    if (!kioskId || !kioskSecret) {
      throw new UnauthorizedException("Kiosk credentials are required.");
    }

    const kiosk = await this.prisma.kiosk.findFirst({
      where: {
        id: kioskId,
        archivedAt: null
      },
      include: {
        credential: true
      }
    });

    if (!kiosk || !kiosk.credential || kiosk.credential.revokedAt) {
      throw new UnauthorizedException("Kiosk is not registered or active.");
    }

    const secretValid = await argon2.verify(kiosk.credential.secretHash, kioskSecret);
    if (!secretValid) {
      throw new UnauthorizedException("Kiosk credentials are invalid.");
    }

    request.kiosk = {
      id: kiosk.id,
      groupId: kiosk.groupId,
      companyId: kiosk.companyId,
      locationId: kiosk.locationId,
      name: kiosk.name
    };

    return true;
  }

  private readHeader(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0]?.trim() ?? "";
    }

    return value?.trim() ?? "";
  }
}
