export type EmailAttachment = {
  filename: string;
  content: Buffer | string;
  contentType: string;
};

export type EmailMessage = {
  to: string;
  fromEmail: string;
  fromName: string;
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: EmailAttachment[];
};

export type EmailSendResult = {
  success: boolean;
  provider: string;
  providerMessageId?: string;
  errorMessage?: string;
};

export type EmailProvider = {
  readonly name: string;
  send(message: EmailMessage): Promise<EmailSendResult>;
};
