import type { EmailAttachment } from "./email.types";

export function summarizeEmailAttachments(attachments?: EmailAttachment[]) {
  return (attachments ?? []).map((attachment) => ({
    filename: attachment.filename,
    contentType: attachment.contentType,
    size: Buffer.isBuffer(attachment.content)
      ? attachment.content.length
      : Buffer.byteLength(attachment.content, "utf8")
  }));
}
