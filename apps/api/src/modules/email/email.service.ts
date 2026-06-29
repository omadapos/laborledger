import { Inject, Injectable } from "@nestjs/common";

import { ConsoleEmailProviderService } from "./console-email-provider.service";
import { resolveEmailProviderMode } from "./email-config";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./email.types";
import { ResendEmailProviderService } from "./resend-email-provider.service";

@Injectable()
export class EmailService {
  constructor(
    @Inject(ConsoleEmailProviderService) private readonly consoleProvider: ConsoleEmailProviderService,
    @Inject(ResendEmailProviderService) private readonly resendProvider: ResendEmailProviderService
  ) {}

  resolveFromIdentity() {
    const fromEmail = process.env.INVOICE_FROM_EMAIL?.trim() || "billing@laborledger.local";
    const fromName = process.env.INVOICE_FROM_NAME?.trim() || "LaborLedger Billing";
    return { fromEmail, fromName };
  }

  async send(message: EmailMessage): Promise<EmailSendResult> {
    return this.resolveProvider().send(message);
  }

  resolveProvider(): EmailProvider {
    const providerMode = resolveEmailProviderMode();

    if (providerMode === "console") {
      return this.consoleProvider;
    }

    return this.resendProvider;
  }
}
