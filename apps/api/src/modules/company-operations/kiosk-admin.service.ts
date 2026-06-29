import { randomBytes } from "node:crypto";

import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import * as argon2 from "argon2";
import { Prisma } from "@prisma/client";

import type { AuthenticatedPrincipal } from "../identity-access/auth.types";
import { CompanyScopeService } from "../identity-access/company-scope.service";
import { PrismaService } from "../identity-access/prisma.service";

type ListKioskOptions = {
  includeArchived?: boolean;
  locationId?: string;
};

type KioskWithRelations = {
  id: string;
  name: string;
  companyId: string;
  locationId: string;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  location: { name: string };
  credential: { createdAt: Date; revokedAt: Date | null } | null;
};

export type KioskViewRecord = {
  id: string;
  name: string;
  companyId: string;
  locationId: string;
  locationName: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  credentialStatus: "active" | "revoked" | "missing";
  credentialCreatedAt: string | null;
};

@Injectable()
export class KioskAdminService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CompanyScopeService) private readonly companyScopeService: CompanyScopeService
  ) {}

  async listKiosks(
    principal: AuthenticatedPrincipal,
    companyId: string,
    options: ListKioskOptions
  ): Promise<KioskViewRecord[]> {
    await this.companyScopeService.requireManagementCompany(principal, companyId);

    const kiosks = await this.prisma.kiosk.findMany({
      where: {
        companyId,
        ...(options.locationId ? { locationId: options.locationId } : {}),
        ...(options.includeArchived ? {} : { archivedAt: null })
      },
      include: {
        location: { select: { name: true } },
        credential: { select: { createdAt: true, revokedAt: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    return kiosks.map((kiosk) => this.serializeKiosk(kiosk));
  }

  async getKiosk(principal: AuthenticatedPrincipal, kioskId: string): Promise<KioskViewRecord> {
    const kiosk = await this.requireKioskRecord(kioskId);
    await this.companyScopeService.requireManagementCompany(principal, kiosk.companyId);
    return this.serializeKiosk(kiosk);
  }

  async createKiosk(
    principal: AuthenticatedPrincipal,
    companyId: string,
    input: { name: string; locationId: string }
  ) {
    const company = await this.companyScopeService.requireManagementCompany(principal, companyId);
    const name = input.name.trim();

    if (!name) {
      throw new BadRequestException("Kiosk name is required.");
    }

    const location = await this.prisma.location.findFirst({
      where: {
        id: input.locationId,
        companyId,
        archivedAt: null
      }
    });

    if (!location) {
      throw new BadRequestException(
        "Location must exist, be active, and belong to the same company."
      );
    }

    const existingKiosk = await this.prisma.kiosk.findUnique({
      where: { locationId: input.locationId }
    });

    if (existingKiosk) {
      if (existingKiosk.archivedAt) {
        throw new BadRequestException(
          "This location already has an archived kiosk. Reactivate it or choose another location."
        );
      }

      throw new BadRequestException("This location already has an active kiosk.");
    }

    const plainSecret = this.generateKioskSecret();
    const secretHash = await this.hashKioskSecret(plainSecret);

    return this.prisma.$transaction(async (tx) => {
      const kiosk = await tx.kiosk.create({
        data: {
          groupId: company.groupId,
          companyId,
          locationId: location.id,
          name
        }
      });

      await tx.kioskCredential.create({
        data: {
          kioskId: kiosk.id,
          secretHash
        }
      });

      const created = await tx.kiosk.findUniqueOrThrow({
        where: { id: kiosk.id },
        include: {
          location: { select: { name: true } },
          credential: { select: { createdAt: true, revokedAt: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "KIOSK_CREATED",
          targetType: "Kiosk",
          targetId: kiosk.id,
          groupId: company.groupId,
          companyId,
          metadata: { locationId: location.id, name }
        }
      ]);

      return {
        kiosk: this.serializeKiosk(created),
        kioskSecret: plainSecret
      };
    });
  }

  async updateKiosk(
    principal: AuthenticatedPrincipal,
    kioskId: string,
    input: { name: string }
  ): Promise<KioskViewRecord> {
    const kiosk = await this.requireKioskRecord(kioskId);
    await this.companyScopeService.requireManagementCompany(principal, kiosk.companyId);

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException("Kiosk name is required.");
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.kiosk.update({
        where: { id: kioskId },
        data: { name }
      });

      const updated = await tx.kiosk.findUniqueOrThrow({
        where: { id: kioskId },
        include: {
          location: { select: { name: true } },
          credential: { select: { createdAt: true, revokedAt: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "KIOSK_UPDATED",
          targetType: "Kiosk",
          targetId: kioskId,
          groupId: kiosk.groupId,
          companyId: kiosk.companyId,
          metadata: { name }
        }
      ]);

      return this.serializeKiosk(updated);
    });
  }

  async archiveKiosk(principal: AuthenticatedPrincipal, kioskId: string): Promise<KioskViewRecord> {
    const kiosk = await this.requireKioskRecord(kioskId);
    await this.companyScopeService.requireManagementCompany(principal, kiosk.companyId);

    if (kiosk.archivedAt) {
      return this.serializeKiosk(kiosk);
    }

    return this.prisma.$transaction(async (tx) => {
      const archivedAt = new Date();
      await tx.kiosk.update({
        where: { id: kioskId },
        data: { archivedAt }
      });

      const updated = await tx.kiosk.findUniqueOrThrow({
        where: { id: kioskId },
        include: {
          location: { select: { name: true } },
          credential: { select: { createdAt: true, revokedAt: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "KIOSK_ARCHIVED",
          targetType: "Kiosk",
          targetId: kioskId,
          groupId: kiosk.groupId,
          companyId: kiosk.companyId,
          metadata: { archivedAt: archivedAt.toISOString() }
        }
      ]);

      return this.serializeKiosk(updated);
    });
  }

  async unarchiveKiosk(principal: AuthenticatedPrincipal, kioskId: string): Promise<KioskViewRecord> {
    const kiosk = await this.requireKioskRecord(kioskId);
    await this.companyScopeService.requireManagementCompany(principal, kiosk.companyId);

    if (!kiosk.archivedAt) {
      return this.serializeKiosk(kiosk);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.kiosk.update({
        where: { id: kioskId },
        data: { archivedAt: null }
      });

      const updated = await tx.kiosk.findUniqueOrThrow({
        where: { id: kioskId },
        include: {
          location: { select: { name: true } },
          credential: { select: { createdAt: true, revokedAt: true } }
        }
      });

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "KIOSK_UNARCHIVED",
          targetType: "Kiosk",
          targetId: kioskId,
          groupId: kiosk.groupId,
          companyId: kiosk.companyId,
          metadata: {}
        }
      ]);

      return this.serializeKiosk(updated);
    });
  }

  async rotateKioskSecret(principal: AuthenticatedPrincipal, kioskId: string) {
    const kiosk = await this.requireKioskRecord(kioskId);
    await this.companyScopeService.requireManagementCompany(principal, kiosk.companyId);

    if (kiosk.archivedAt) {
      throw new BadRequestException("Reactivate the kiosk before rotating its secret.");
    }

    const plainSecret = this.generateKioskSecret();
    const secretHash = await this.hashKioskSecret(plainSecret);

    return this.prisma.$transaction(async (tx) => {
      const existingCredential = await tx.kioskCredential.findUnique({
        where: { kioskId }
      });

      if (!existingCredential) {
        await tx.kioskCredential.create({
          data: {
            kioskId,
            secretHash
          }
        });
      } else {
        await tx.kioskCredential.update({
          where: { kioskId },
          data: {
            secretHash,
            revokedAt: null
          }
        });
      }

      await this.createAuditEvents(tx, [
        {
          actorUserId: principal.userId,
          action: "KIOSK_SECRET_ROTATED",
          targetType: "Kiosk",
          targetId: kioskId,
          groupId: kiosk.groupId,
          companyId: kiosk.companyId,
          metadata: {}
        }
      ]);

      return {
        kioskId,
        kioskSecret: plainSecret
      };
    });
  }

  private async requireKioskRecord(kioskId: string): Promise<KioskWithRelations & { groupId: string }> {
    const kiosk = await this.prisma.kiosk.findUnique({
      where: { id: kioskId },
      include: {
        location: { select: { name: true } },
        credential: { select: { createdAt: true, revokedAt: true } }
      }
    });

    if (!kiosk) {
      throw new NotFoundException("Kiosk not found.");
    }

    return kiosk;
  }

  private serializeKiosk(kiosk: KioskWithRelations): KioskViewRecord {
    const credentialStatus = !kiosk.credential
      ? "missing"
      : kiosk.credential.revokedAt
        ? "revoked"
        : "active";

    return {
      id: kiosk.id,
      name: kiosk.name,
      companyId: kiosk.companyId,
      locationId: kiosk.locationId,
      locationName: kiosk.location.name,
      archivedAt: kiosk.archivedAt?.toISOString() ?? null,
      createdAt: kiosk.createdAt.toISOString(),
      updatedAt: kiosk.updatedAt.toISOString(),
      credentialStatus,
      credentialCreatedAt: kiosk.credential?.createdAt.toISOString() ?? null
    };
  }

  private generateKioskSecret() {
    return randomBytes(32).toString("base64url");
  }

  private async hashKioskSecret(secret: string) {
    return argon2.hash(secret, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1
    });
  }

  private async createAuditEvents(
    tx: Prisma.TransactionClient,
    data: Prisma.AuditEventCreateManyInput[]
  ) {
    if (data.length === 0) {
      return;
    }

    await tx.auditEvent.createMany({ data });
  }
}
