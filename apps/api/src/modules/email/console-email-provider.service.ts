import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import type { EmailMessage, EmailProvider, EmailSendResult } from "./email.types";
import { summarizeEmailAttachments } from "./email-attachment-utils";

const FAILURE_RECIPIENT_SUFFIX = "@delivery-fail.test";

@Injectable()
export class ConsoleEmailProviderService implements EmailProvider {
  readonly name = "console";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    const normalizedTo = message.to.trim().toLowerCase();

    if (normalizedTo.endsWith(FAILURE_RECIPIENT_SUFFIX)) {
      return {
        success: false,
        provider: this.name,
        errorMessage: "Simulated email delivery failure for testing."
      };
    }

    // Structured dev/test log — no real email sent.
    console.info(
      JSON.stringify({
        event: "EMAIL_DELIVERY_CONSOLE",
        provider: this.name,
        to: message.to,
        from: `${message.fromName} <${message.fromEmail}>`,
        subject: message.subject,
        textPreview: message.textBody.slice(0, 500),
        attachments: summarizeEmailAttachments(message.attachments)
      })
    );

    return {
      success: true,
      provider: this.name,
      providerMessageId: `console-${randomUUID()}`
    };
  }
}
