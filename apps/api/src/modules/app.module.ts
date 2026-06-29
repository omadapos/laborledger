import { Module } from "@nestjs/common";
import { MiddlewareConsumer, NestModule } from "@nestjs/common";

import { AppController } from "./app.controller";
import { CompanyOperationsController } from "./company-operations/company-operations.controller";
import { CompanyOperationsService } from "./company-operations/company-operations.service";
import { KioskAdminService } from "./company-operations/kiosk-admin.service";
import { ShiftReviewService } from "./shift-review/shift-review.service";
import { CorrectionsService } from "./corrections/corrections.service";
import { WeeklyCloseService } from "./weekly-close/weekly-close.service";
import { WeeklyPeriodLockService } from "./weekly-close/weekly-period-lock.service";
import { StubVinDecoderService } from "./vin-decode/stub-vin-decoder.service";
import { NhtsaVpicVinDecoderService } from "./vin-decode/nhtsa-vpic-vin-decoder.service";
import { VinDecodeService } from "./vin-decode/vin-decode.service";
import { KioskAuthGuard } from "./kiosk/kiosk-auth.guard";
import { KioskController } from "./kiosk/kiosk.controller";
import { KioskPunchService } from "./kiosk/kiosk-punch.service";
import { WorkerController } from "./worker/worker.controller";
import { FieldLaborWorkController } from "./labor-work-assignment/field-labor-work.controller";
import { FieldJobService } from "./worker/field-job.service";
import { LaborWorkAssignmentService } from "./labor-work-assignment/labor-work-assignment.service";
import { WorkerResponsibilityService } from "./worker/worker-responsibility.service";
import { AuthController } from "./identity-access/auth.controller";
import { CompaniesController } from "./identity-access/companies.controller";
import { InvitationsController } from "./identity-access/invitations.controller";
import { PlatformGroupsController } from "./identity-access/platform-groups.controller";
import { PlatformCustomersController } from "./identity-access/platform-customers.controller";
import { AuthenticatedGuard } from "./identity-access/authenticated.guard";
import { AuthService } from "./identity-access/auth.service";
import { AuthSessionMiddleware } from "./identity-access/auth-session.middleware";
import { CompanyAccessService } from "./identity-access/company-access.service";
import { CompanyScopeService } from "./identity-access/company-scope.service";
import { InvitationService } from "./identity-access/invitation.service";
import { PasswordResetService } from "./identity-access/password-reset.service";
import { UserInvitationService } from "./identity-access/user-invitation.service";
import { PasswordService } from "./identity-access/password.service";
import { PlatformGroupService } from "./identity-access/platform-group.service";
import { GroupAccessService } from "./identity-access/group-access.service";
import { PlatformCustomerService } from "./identity-access/platform-customer.service";
import { PrismaService } from "./identity-access/prisma.service";
import { SessionService } from "./identity-access/session.service";
import { SuperadminBootstrapService } from "./identity-access/superadmin-bootstrap.service";
import { SuperadminGuard } from "./identity-access/superadmin.guard";
import { ConsoleEmailProviderService } from "./email/console-email-provider.service";
import { EmailService } from "./email/email.service";
import { ResendEmailProviderService } from "./email/resend-email-provider.service";
import { ClientInvoiceDeliveryService } from "./client-invoice-delivery/client-invoice-delivery.service";
import { ClientInvoicePdfService } from "./client-invoice-pdf/client-invoice-pdf.service";
import { OperationsReportsService } from "./operations-reports/operations-reports.service";
import { LaborPayBillingService } from "./labor-pay-billing/labor-pay-billing.service";

@Module({
  controllers: [
    AppController,
    AuthController,
    PlatformGroupsController,
    PlatformCustomersController,
    InvitationsController,
    CompaniesController,
    CompanyOperationsController,
    KioskController,
    WorkerController,
    FieldLaborWorkController
  ],
  providers: [
    PrismaService,
    PasswordService,
    SessionService,
    AuthService,
    SuperadminBootstrapService,
    PlatformGroupService,
    PlatformCustomerService,
    InvitationService,
    PasswordResetService,
    UserInvitationService,
    CompanyAccessService,
    CompanyScopeService,
    GroupAccessService,
    CompanyOperationsService,
    KioskAdminService,
    ShiftReviewService,
    CorrectionsService,
    WeeklyCloseService,
    WeeklyPeriodLockService,
    KioskPunchService,
    WorkerResponsibilityService,
    FieldJobService,
    LaborWorkAssignmentService,
    KioskAuthGuard,
    StubVinDecoderService,
    NhtsaVpicVinDecoderService,
    VinDecodeService,
    ConsoleEmailProviderService,
    ResendEmailProviderService,
    EmailService,
    ClientInvoiceDeliveryService,
    ClientInvoicePdfService,
    OperationsReportsService,
    LaborPayBillingService,
    AuthSessionMiddleware,
    AuthenticatedGuard,
    SuperadminGuard
  ]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthSessionMiddleware).forRoutes("*");
  }
}
