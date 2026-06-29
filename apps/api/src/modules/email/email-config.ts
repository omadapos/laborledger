import { BadRequestException } from "@nestjs/common";

export type EmailProviderMode = "console" | "resend";

const KNOWN_PROVIDERS: EmailProviderMode[] = ["console", "resend"];

export function resolveEmailProviderMode(): EmailProviderMode {
  const raw = (process.env.EMAIL_PROVIDER ?? "console").trim().toLowerCase();

  if (!KNOWN_PROVIDERS.includes(raw as EmailProviderMode)) {
    throw new BadRequestException(
      `Email provider "${raw}" is not configured. Use EMAIL_PROVIDER=console or EMAIL_PROVIDER=resend.`
    );
  }

  return raw as EmailProviderMode;
}

export function resolveResendApiKey(): string {
  const apiKey = process.env.RESEND_API_KEY?.trim() ?? "";

  if (!apiKey) {
    throw new BadRequestException("EMAIL_PROVIDER=resend requires RESEND_API_KEY.");
  }

  return apiKey;
}

export function formatEmailFrom(fromName: string, fromEmail: string): string {
  const name = fromName.trim() || "LaborLedger";
  const email = fromEmail.trim();
  return `${name} <${email}>`;
}

export function assertResendSenderEmail(fromEmail: string): void {
  const email = fromEmail.trim();

  if (!email) {
    throw new BadRequestException("A sender email is required when EMAIL_PROVIDER=resend.");
  }

  if (email.endsWith(".local")) {
    throw new BadRequestException(
      "Configure INVOICE_FROM_EMAIL or AUTH_FROM_EMAIL with a verified domain when EMAIL_PROVIDER=resend."
    );
  }
}
