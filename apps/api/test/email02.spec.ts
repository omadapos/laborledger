import { BadRequestException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  assertResendSenderEmail,
  formatEmailFrom,
  resolveEmailProviderMode,
  resolveResendApiKey
} from "../src/modules/email/email-config";
import { ConsoleEmailProviderService } from "../src/modules/email/console-email-provider.service";
import { EmailService } from "../src/modules/email/email.service";
import { ResendEmailProviderService } from "../src/modules/email/resend-email-provider.service";

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn()
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: sendMock
    }
  }))
}));

describe("EMAIL02 email provider integration", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    sendMock.mockReset();
    process.env = { ...originalEnv };
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  function createEmailService() {
    return new EmailService(new ConsoleEmailProviderService(), new ResendEmailProviderService());
  }

  const sampleMessage = {
    to: "user@example.com",
    fromEmail: "billing@example.com",
    fromName: "LaborLedger Billing",
    subject: "Test subject",
    textBody: "Hello from LaborLedger."
  };

  describe("resolveEmailProviderMode", () => {
    it("defaults to console when EMAIL_PROVIDER is unset", () => {
      expect(resolveEmailProviderMode()).toBe("console");
    });

    it("selects console for EMAIL_PROVIDER=console", () => {
      process.env.EMAIL_PROVIDER = "console";
      expect(resolveEmailProviderMode()).toBe("console");
    });

    it("selects resend for EMAIL_PROVIDER=resend", () => {
      process.env.EMAIL_PROVIDER = "resend";
      expect(resolveEmailProviderMode()).toBe("resend");
    });

    it("fails clearly for unknown EMAIL_PROVIDER", () => {
      process.env.EMAIL_PROVIDER = "smtp";

      expect(() => resolveEmailProviderMode()).toThrow(BadRequestException);
      expect(() => resolveEmailProviderMode()).toThrow(/smtp/);
    });
  });

  describe("resolveResendApiKey", () => {
    it("fails clearly when RESEND_API_KEY is missing", () => {
      process.env.EMAIL_PROVIDER = "resend";

      expect(() => resolveResendApiKey()).toThrow(BadRequestException);
      expect(() => resolveResendApiKey()).toThrow(/RESEND_API_KEY/);
    });
  });

  describe("EmailService provider selection", () => {
    it("uses console provider by default", () => {
      const service = createEmailService();
      expect(service.resolveProvider().name).toBe("console");
    });

    it("uses console provider when configured", () => {
      process.env.EMAIL_PROVIDER = "console";
      const service = createEmailService();
      expect(service.resolveProvider().name).toBe("console");
    });

    it("uses resend provider when configured", () => {
      process.env.EMAIL_PROVIDER = "resend";
      const service = createEmailService();
      expect(service.resolveProvider().name).toBe("resend");
    });
  });

  describe("ResendEmailProviderService", () => {
    const provider = new ResendEmailProviderService();

    it("maps success response to success=true with provider message id", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      sendMock.mockResolvedValue({ data: { id: "msg_123" }, error: null });

      const result = await provider.send(sampleMessage);

      expect(result).toEqual({
        success: true,
        provider: "resend",
        providerMessageId: "msg_123"
      });
      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          from: formatEmailFrom(sampleMessage.fromName, sampleMessage.fromEmail),
          to: [sampleMessage.to],
          subject: sampleMessage.subject,
          text: sampleMessage.textBody
        })
      );
    });

    it("maps API failure to success=false without throwing", async () => {
      process.env.RESEND_API_KEY = "re_test_key";
      sendMock.mockResolvedValue({
        data: null,
        error: { message: "Resend rejected recipient." }
      });

      const result = await provider.send(sampleMessage);

      expect(result.success).toBe(false);
      expect(result.provider).toBe("resend");
      expect(result.errorMessage).toBe("Resend rejected recipient.");
    });

    it("returns structured failure when RESEND_API_KEY is missing", async () => {
      const result = await provider.send(sampleMessage);

      expect(result.success).toBe(false);
      expect(result.provider).toBe("resend");
      expect(result.errorMessage).toContain("RESEND_API_KEY");
      expect(sendMock).not.toHaveBeenCalled();
    });

    it("rejects .local sender addresses for resend", async () => {
      process.env.RESEND_API_KEY = "re_test_key";

      const result = await provider.send({
        ...sampleMessage,
        fromEmail: "billing@laborledger.local"
      });

      expect(result.success).toBe(false);
      expect(result.errorMessage).toContain("INVOICE_FROM_EMAIL");
      expect(sendMock).not.toHaveBeenCalled();
    });
  });

  describe("ConsoleEmailProviderService", () => {
    it("continues to succeed for normal recipients", async () => {
      process.env.EMAIL_PROVIDER = "console";
      const service = createEmailService();

      const result = await service.send(sampleMessage);

      expect(result.success).toBe(true);
      expect(result.provider).toBe("console");
      expect(result.providerMessageId).toMatch(/^console-/);
    });

    it("logs attachment metadata without full content for console provider", async () => {
      const provider = new ConsoleEmailProviderService();
      const logSpy = vi.spyOn(console, "info").mockImplementation(() => undefined);

      await provider.send({
        ...sampleMessage,
        attachments: [
          {
            filename: "invoice-INV-1.pdf",
            contentType: "application/pdf",
            content: Buffer.from("%PDF-1.4 secret-should-not-log")
          }
        ]
      });

      const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
        attachments: Array<{ filename: string; contentType: string; size: number }>;
      };

      expect(payload.attachments).toEqual([
        {
          filename: "invoice-INV-1.pdf",
          contentType: "application/pdf",
          size: Buffer.from("%PDF-1.4 secret-should-not-log").length
        }
      ]);
      expect(JSON.stringify(payload)).not.toContain("secret-should-not-log");

      logSpy.mockRestore();
    });
  });

  describe("assertResendSenderEmail", () => {
    it("requires a non-local sender for resend", () => {
      expect(() => assertResendSenderEmail("billing@laborledger.local")).toThrow(/verified domain/);
    });
  });
});
