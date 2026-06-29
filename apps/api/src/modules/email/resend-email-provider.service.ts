import { Injectable } from "@nestjs/common";
import { Resend } from "resend";

import {
  assertResendSenderEmail,
  formatEmailFrom,
  resolveResendApiKey
} from "./email-config";
import type { EmailMessage, EmailProvider, EmailSendResult } from "./email.types";

@Injectable()
export class ResendEmailProviderService implements EmailProvider {
  readonly name = "resend";

  async send(message: EmailMessage): Promise<EmailSendResult> {
    try {
      assertResendSenderEmail(message.fromEmail);
      const apiKey = resolveResendApiKey();
      const resend = new Resend(apiKey);

      const payload: {
        from: string;
        to: string[];
        subject: string;
        text: string;
        html?: string;
        attachments?: Array<{
          filename: string;
          content: Buffer;
        }>;
      } = {
        from: formatEmailFrom(message.fromName, message.fromEmail),
        to: [message.to.trim()],
        subject: message.subject,
        text: message.textBody
      };

      if (message.htmlBody?.trim()) {
        payload.html = message.htmlBody;
      }

      if (message.attachments?.length) {
        payload.attachments = message.attachments.map((attachment) => ({
          filename: attachment.filename,
          content: Buffer.isBuffer(attachment.content)
            ? attachment.content
            : Buffer.from(attachment.content, "utf8")
        }));
      }

      const { data, error } = await resend.emails.send(payload);

      if (error) {
        return {
          success: false,
          provider: this.name,
          errorMessage: error.message
        };
      }

      return {
        success: true,
        provider: this.name,
        providerMessageId: data?.id
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unable to send email through Resend.";

      return {
        success: false,
        provider: this.name,
        errorMessage
      };
    }
  }
}
